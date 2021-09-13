const { DOMParser } = require('xmldom')

chrome.runtime.onInstalled.addListener(() => {})

chrome.storage.onChanged.addListener(function (changes, namespace) {
  chrome.storage.sync.get(null, (data) => {
    if(changes.hasOwnProperty("pollingEnabled")) {
      if(changes['pollingEnabled'].newValue) {
        chrome.alarms.create("buildkite-polling", { periodInMinutes:data.delayInMinutes })
      } else {
        chrome.alarms.clear("buildkite-polling")
      }
    }

    if(changes.hasOwnProperty("delayInMinutes")) {
      chrome.alarms.clear("buildkite-polling")
      if(data.pollingEnabled) {
        chrome.alarms.create("buildkite-polling", { periodInMinutes:changes['delayInMinutes'].newValue })
      }
    }

    if(changes.hasOwnProperty("projectList")) {
      tick()
    }
  })
});

chrome.alarms.onAlarm.addListener(() => {
  tick()
})

function tick() {
  chrome.storage.sync.get(null, (data) => {
    if(!data.buildkiteApiAccessToken) {
      return
    }
    getProjects(data.projectList, data.buildkiteApiAccessToken).then((projects) => {
      chrome.storage.sync.get(`projectData`, ({projectData}) => {
        let previousProjectData = projectData ?? []
        let setDataObj = {}
        setDataObj[`projectData`] = projects
        chrome.storage.sync.set(setDataObj)

        let changed = projects.filter(project => {
          let previousProject = previousProjectData.find(prevProject => prevProject.name == projectData.name)
          if(!previousProject) {
            return false
          }
          return project.lastBuildStatus != previousProject.lastBuildStatus
        })
        changed.forEach(project => {
          chrome.notifications.create({type:"basic", iconUrl:`images/${project.lastBuildStatus}.png`, title:`${project.name}`, message:`Build ${project.lastBuildStatus} at ${project.lastBuildTime}`})
        })

        let failed = projects.filter(project => {
          return project.lastBuildStatus != "Success"
        })
        chrome.action.getUserSettings().then(userSettings => {
          if(!userSettings.isOnToolbar) {
            return
          }
          if(failed.length > 0 ) {
            chrome.action.setIcon({
              path: {
                16: "images/buildkite_failure16.png",
                32: "images/buildkite_failure32.png",
                48: "images/buildkite_failure48.png",
                128: "images/buildkite_failure128.png",
              }
            });
          } else {
            chrome.action.setIcon({
              path: {
                16: "images/buildkite16.png",
                32: "images/buildkite32.png",
                48: "images/buildkite48.png",
                128: "images/buildkite128.png",
              }
            });
          }
        })
      })
    })
  })
}

async function getProjects(projectList, apiAccessToken) {
  let projectData = []
  if(!projectList) {
    return projectData
  }
  for(let i = 0; i < projectList.length; i++) {
    let project = projectList[i]
    let url = `${project.url}&access_token=${apiAccessToken}`
  
    let response = await fetch(url)
    if(!response.ok) {
      let jsonResponse = await response.json()
      throw new Error(`${response.status}: ${jsonResponse.message}`)
    }
    let xmlText = await response.text()
    let data = new DOMParser().parseFromString(xmlText, "text/xml")
    let projectsElements = data.getElementsByTagName("Project")
    for(let i = 0; i < projectsElements.length; i++) {
      let projectElement = projectsElements[i]
      let prjData = getProjectData(projectElement, project.organizationSlug, project.branch)
      projectData.push(prjData)
    }
  }
  return projectData
}

function getProjectData(projectElement, organizationSlug, pipelineBranch) {
  let project = {}
  project['name'] = projectElement.getAttribute("name")
  project['pipelineSlug'] = projectElement.getAttribute("name").replace(` (${pipelineBranch})`, '')
  project['organizationSlug'] = organizationSlug
  project['branch'] = pipelineBranch
  project['lastBuildStatus'] = projectElement.getAttribute("lastBuildStatus") ?? "undetermined"
  project['activity'] = projectElement.getAttribute("activity")
  project['lastBuildTime'] = projectElement.getAttribute("lastBuildTime")
  project['url'] = `https://cc.buildkite.com/${organizationSlug}/${project.pipelineSlug}.xml?branch=${pipelineBranch}`
  project['webUrl'] = projectElement.getAttribute("webUrl")
  return project
}


chrome.storage.sync.get(null, (data) => {
  let delayInMinutes = data.delayInMinutes
  if(!data.delayInMinutes) {
    delayInMinutes = 1
    chrome.storage.sync.set({delayInMinutes})
  }
  chrome.alarms.create("buildkite-polling", { periodInMinutes:delayInMinutes })
})

tick()
