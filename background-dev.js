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
  })
});

chrome.alarms.onAlarm.addListener(() => {
  tick()
})

function tick() {
  chrome.storage.sync.get(null, (data) => {
    getProjects(data.buildkiteOrganizationSlug, data.buildkiteApiAccessToken).then((projects) => {      
      let filteredProjects = projects.filter(project => {
        return data.projectList.find(name => name == project.name)
      })

      chrome.storage.sync.get(`${data.buildkiteOrganizationSlug}-projectData`, ({projectData}) => {
        let previousProjectData = projectData ?? []
        let setDataObj = {}
        setDataObj[`${data.buildkiteOrganizationSlug}-projectData`] = filteredProjects
        chrome.storage.sync.set(setDataObj)

        let changed = filteredProjects.filter(project => {
          let previousProject = previousProjectData.find(prevProject => project.name == prevProject)
          if(!previousProject) {
            return false
          }
          return project.lastBuildStatus != previousProject.lastBuildStatus
        })
        changed.forEach(project => {
          chrome.notifications.create({type:"basic", iconUrl:`images/${project.lastBuildStatus}.png`, title:`${project.name}`, message:`Build ${project.lastBuildStatus} at ${project.lastBuildTime}`})
        })
      })
    })
  })
}

async function getProjects(organizationSlug, apiAccessToken) {
  let response = await fetch(`https://cc.buildkite.com/${organizationSlug}.xml?access_token=${apiAccessToken}`)
  if(!response.ok) {
    let jsonResponse = await response.json()
    throw new Error(`${response.status}: ${jsonResponse.message}`)
  }
  let xmlText = await response.text()
  let data = new DOMParser().parseFromString(xmlText, "text/xml")
  let projectsElements = data.getElementsByTagName("Project")
  let projectData = []
  for(let i = 0; i < projectsElements.length; i++) {
    let projectElement = projectsElements[i]
    projectData.push(getProjectData(projectElement))
  }
  return projectData
}

function getProjectData(projectElement) {
  let project = {}
  project['name'] = projectElement.getAttribute("name")
  project['lastBuildStatus'] = projectElement.getAttribute("lastBuildStatus") ?? "undetermined"
  project['activity'] = projectElement.getAttribute("activity")
  project['lastBuildTime'] = projectElement.getAttribute("lastBuildTime")
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
