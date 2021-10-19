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
    apiTokenInput.value = buildkiteApiAccessToken ?? ""
  })
  let accessTokenHelp = document.getElementById("show-access-token-help")
  accessTokenHelp.addEventListener("click", toggleAccessTokenHelp)
  let organizationSlugInput = document.getElementById("buildkite-organization-slug")
  organizationSlugInput.addEventListener("blur", organizationSlugChange)
  chrome.storage.sync.get("buildkiteOrganizationSlug", ({buildkiteOrganizationSlug}) => {
    organizationSlugInput.value = buildkiteOrganizationSlug ?? ""
  })

  let pipelineBranchInput = document.getElementById("buildkite-pipeline-branch")
  pipelineBranchInput.addEventListener("blur", pipelineBranchChange)
  chrome.storage.sync.get("buildkitePipelineBranch", ({buildkitePipelineBranch}) => {
    pipelineBranchInput.value = buildkitePipelineBranch ?? ""
  })

  chrome.storage.sync.get(null, (data) => {
    let organizationSlug = data.buildkiteOrganizationSlug
    let apiAccessToken = data.buildkiteApiAccessToken
    let pipelineBranch = data.buildkitePipelineBranch
    rebuildProjectList(organizationSlug, apiAccessToken, pipelineBranch)
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

  let deletePipelineButton = document.getElementById('delete-pipeline-data')
  deletePipelineButton.addEventListener("click", deletePipelineDataTrigger)
}

async function rebuildProjectList(organizationSlug, apiAccessToken, pipelineBranch) {
  let pipelinesContainer = document.getElementById("buildkite-pipelines")
  pipelinesContainer.innerHTML = ""
  let url = `https://cc.buildkite.com/${organizationSlug}.xml`
  if(pipelineBranch) {
    url += `?branch=${pipelineBranch}`
  }
  let urlElement = document.createElement("p")
  urlElement.innerText = url
  pipelinesContainer.appendChild(urlElement)

  let projects = await getProjects(organizationSlug, apiAccessToken, pipelineBranch)

  for(let i = 0; i < projects.length; i++) {
    let project = projects[i]
    let projectRow = document.createElement("div")
    projectRow.classList.add("buildkite-project")
    let projectName = project["name"]
    let lastBuildStatus = project["lastBuildStatus"]
    let activity = project["activity"]

    let enabledCheckbox = document.createElement("input")
    enabledCheckbox.type = "checkbox"
    isProjectEnabled(project, (result) => {
      enabledCheckbox.checked = result
    })
    enabledCheckbox.addEventListener("change", (event) => { projectCheckboxChange(event, project)})

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

async function getProjects(organizationSlug, apiAccessToken, pipelineBranch) {
  if(!apiAccessToken) {
    return []
  }
  let url = `https://cc.buildkite.com/${organizationSlug}.xml?access_token=${apiAccessToken}`
  let response = await fetch(url)
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
    let project = getProjectData(projectElement, organizationSlug, pipelineBranch)
    projectData.push(project)
  }
  return projectData
}

function getProjectData(projectElement, organizationSlug, pipelineBranch) {
  let project = {}
  project['name'] = projectElement.getAttribute("name")
  project['pipelineSlug'] = projectElement.getAttribute("name").replace(` (${pipelineBranch})`, '')
  let ccMenuPipelineSlug = project.pipelineSlug.replaceAll('_', '-')
  project['organizationSlug'] = organizationSlug
  project['branch'] = pipelineBranch
  project['lastBuildStatus'] = projectElement.getAttribute("lastBuildStatus") ?? "undetermined"
  project['activity'] = projectElement.getAttribute("activity")
  project['lastBuildTime'] = projectElement.getAttribute("lastBuildTime")
  project['url'] = `https://cc.buildkite.com/${organizationSlug}/${ccMenuPipelineSlug}.xml?branch=${pipelineBranch}`
  project['webUrl'] = projectElement.getAttribute("webUrl")
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
  chrome.storage.sync.get(null, (data) => {
    rebuildProjectList(buildkiteOrganizationSlug, data.buildkiteApiAccessToken, data.buildkitePipelineBranch)
  })
}

function pipelineBranchChange(event) {
  let buildkitePipelineBranch = event.target.value
  chrome.storage.sync.set({buildkitePipelineBranch})
  chrome.storage.sync.get(null, (data) => {
    rebuildProjectList(data.buildkiteOrganizationSlug, data.buildkiteApiAccessToken, buildkitePipelineBranch)
  })
}

function isProjectEnabled(project, resultHandler) {
  chrome.storage.sync.get("projectList", ({projectList}) => {
    if(!projectList) {
      projectList = []
    }
    resultHandler(projectList.filter(prj => prj.name == project.name ).length > 0)
  })
}

function projectCheckboxChange(event, project) {
  let isProjectEnabled = event.target.checked == true
  chrome.storage.sync.get("projectList", ({projectList}) => {
    if(!projectList) {
      projectList = []
    }
    projectList = projectList.filter(prj => { return prj.name != project.name})
    if(isProjectEnabled) {
      projectList.push(project)
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
  chrome.notifications.create({type:"basic", iconUrl:"images/buildkite128.png", title:"Buildkite Build Status Plugin Notification", message:"This is an example notification"})
}

function deletePipelineDataTrigger() {
  chrome.storage.sync.remove("projectList")
}

constructOptions(presetButtonColors)
