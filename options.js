let page = document.getElementById("buttonDiv")
let selectedClassName = "current"
const presetButtonColors = [
  "#3aa757",
  "#e8453c",
  "#f9bb2d",
  "#4688f1"
]

function handleButtonClick(event) {
  let current = event.target.parentElement.querySelector(`.${selectedClassName}`)
  if(current && current != event.target) {
    current.classList.remove(selectedClassName)
  }

  let color = event.target.dataset.color
  event.target.classList.add(selectedClassName)
  chrome.storage.sync.set({color})
}

function constructOptions(buttonColors) {

  let apiTokenInput = document.getElementById("buildkite-api-access-token")
  apiTokenInput.addEventListener("blur", apiTokenChange)
  chrome.storage.sync.get("buildkiteApiAccessToken", ({buildkiteApiAccessToken}) => {
    apiTokenInput.value = buildkiteApiAccessToken
  })
  let accessTokenHelp = document.getElementById("show-access-token-help")
  accessTokenHelp.addEventListener("click", toggleAccessTokenHelp)
  let organizationSlugInput = document.getElementById("buildkite-organization-slug")
  organizationSlugInput.addEventListener("blur", organizationSlugChange)
  chrome.storage.sync.get("buildkiteOrganizationSlug", ({buildkiteOrganizationSlug}) => {
    organizationSlugInput.value = buildkiteOrganizationSlug
  })

  
  chrome.storage.sync.get(null, (data) => {
    let organizationSlug = data.buildkiteOrganizationSlug
    let apiAccessToken = data.buildkiteApiAccessToken
    rebuildProjectList(organizationSlug, apiAccessToken)
  })

  let pollDelayInput = document.getElementById("poll-delay-in-minutes")
  chrome.storage.sync.get(null, (data) => {
    let delayInMinutes = data.delayInMinutes
    pollDelayInput.value = delayInMinutes ?? 1
  })
  pollDelayInput.addEventListener("change", pollDelayChange)

  let pollEnabledInput = document.getElementById("polling-enabled")
  chrome.storage.sync.get(null, (data) => {
    let pollingEnabled = data.pollingEnabled
    pollEnabledInput.checked = pollingEnabled ?? true
  })
  pollEnabledInput.addEventListener("change", pollEnabledChange)

  let debugButton = document.getElementById('debug')
  debugButton.addEventListener("click", debugTrigger)
}

async function rebuildProjectList(organizationSlug, apiAccessToken) {
  let pipelinesContainer = document.getElementById("buildkite-pipelines")
  pipelinesContainer.innerHTML = ""
  let url = `https://cc.buildkite.com/${organizationSlug}.xml`
  let urlElement = document.createElement("p")
  urlElement.innerText = url
  pipelinesContainer.appendChild(urlElement)

  let projects = await getProjects(organizationSlug, apiAccessToken)
  // let response = await fetch(`${url}?access_token=${apiAccessToken}`)
  // if(!response.ok) {
  //   let jsonResponse = await response.json()
  //   let errorMessage = document.createElement("p")
  //   errorMessage.classList.add("error")
  //   let message = `${response.status}: ${jsonResponse.message}`
  //   errorMessage.innerText = message
  //   pipelinesContainer.appendChild(errorMessage)
  //   return
  // }
  // let xmlText = await response.text()
  // let data = (new window.DOMParser()).parseFromString(xmlText, "text/xml")
  // let projectsElements = data.getElementsByTagName("Project")
  // for(let i = 0; i < projectsElements.length; i++) {
  for(let i = 0; i < projects.length; i++) {
    let project = projects[i]
    let projectRow = document.createElement("div")
    projectRow.classList.add("buildkite-project")
    let projectName = project["name"]
    let lastBuildStatus = project["lastBuildStatus"]
    let activity = project["activity"]
    let lastBuildTime = project["lastBuildTime"]

    let enabledCheckbox = document.createElement("input")
    enabledCheckbox.type = "checkbox"
    isProjectEnabled(projectName, (result) => {
      enabledCheckbox.checked = result
    })
    enabledCheckbox.addEventListener("change", (event) => { projectCheckboxChange(event, organizationSlug, projectName)})

    let statusDiv = document.createElement("div")
    statusDiv.classList.add("project-status")
    statusDiv.classList.add(`${lastBuildStatus.toLowerCase()}`)

    let projectNameElement = document.createElement("p")
    projectNameElement.classList.add("project-name")
    projectNameElement.innerText = projectName

    let activityDiv = document.createElement("div")
    activityDiv.classList.add("project-activity")
    activityDiv.classList.add(`${activity.toLowerCase()}`)

    projectRow.appendChild(enabledCheckbox)
    projectRow.appendChild(statusDiv)
    projectRow.appendChild(activityDiv)
    projectRow.appendChild(projectNameElement)

    pipelinesContainer.appendChild(projectRow)
  }
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

function apiTokenChange(event) {
  let buildkiteApiAccessToken = event.target.value
  chrome.storage.sync.set({buildkiteApiAccessToken})
}

function toggleAccessTokenHelp() {
  let helpDiv = document.getElementById("access-token-help")
  helpDiv.style.display = helpDiv.style.display == "none" ? "block" : "none"
}

function organizationSlugChange(event) {
  let buildkiteOrganizationSlug = event.target.value
  chrome.storage.sync.set({buildkiteOrganizationSlug})
  chrome.storage.sync.get("buildkiteApiAccessToken", ({buildkiteApiAccessToken}) => {
    rebuildProjectList(buildkiteOrganizationSlug, buildkiteApiAccessToken)
  })
}

function isProjectEnabled(projectName, resultHandler) {
  chrome.storage.sync.get("projectList", ({projectList}) => {
    if(!projectList) {
      projectList = []
    }
    resultHandler(projectList.filter(name => name == projectName ).length > 0)
  })
}

function projectCheckboxChange(event, organizationSlug, projectName) {
  let isProjectEnabled = event.target.checked == true
  chrome.storage.sync.get("projectList", ({projectList}) => {
    if(!projectList) {
      projectList = []
    }
    if(isProjectEnabled) {
      projectList.push(projectName)
    } else {
      projectList = projectList.filter(name => { return name != projectName})
    }
    chrome.storage.sync.set({projectList})
  })
}

function pollDelayChange(event) {
  let delayInMinutes = parseInt(event.target.value)
  chrome.storage.sync.set({delayInMinutes})
}

function pollEnabledChange(event) {
  let pollingEnabled = event.target.checked == true
  chrome.storage.sync.set({pollingEnabled})
}

function debugTrigger() {
  chrome.notifications.create({type:"basic", iconUrl:"images/get_started48.png", title:"Title thing", message:"This is a message"})
}


constructOptions(presetButtonColors)
