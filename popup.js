chrome.storage.onChanged.addListener(function (changes, namespace) {
  chrome.storage.sync.get(null, (data) => {
    if(changes.hasOwnProperty(`${data.buildkiteOrganizationSlug}-projectData`)) {
      let projectData = changes[`${data.buildkiteOrganizationSlug}-projectData`].newValue ?? []
      rebuildProjectList(data.buildkiteOrganizationSlug, projectData)
    }
  })
})

chrome.storage.sync.get(null, (data) => {
  let projectData = data[`${data.buildkiteOrganizationSlug}-projectData`] ?? []
  rebuildProjectList(data.buildkiteOrganizationSlug, projectData)
})


async function rebuildProjectList(organizationSlug, projects) {
  let pipelinesContainer = document.getElementById("buildkite-pipelines-display")
  for(let i = 0; i < projects.length; i++) {
    let project = projects[i]
    let projectRow = document.createElement("div")
    projectRow.classList.add("buildkite-project")
    let projectName = project.name
    let lastBuildStatus = project.lastBuildStatus
    let activity = project.activity
    let lastBuildTime = project.lastBuildTime

    let statusDiv = document.createElement("div")
    statusDiv.classList.add("project-status")
    statusDiv.classList.add(`${lastBuildStatus.toLowerCase()}`)

    let projectNameElement = document.createElement("div")
    projectNameElement.classList.add("project-name")

    let projectNameLink = document.createElement("a")
    projectNameLink.href = `https://buildkite.com/${organizationSlug}/${projectName}`
    projectNameLink.target = "_blank"
    projectNameLink.innerText = projectName

    projectNameElement.appendChild(projectNameLink)

    let activityDiv = document.createElement("div")
    activityDiv.classList.add("project-activity")
    activityDiv.classList.add(`${activity.toLowerCase()}`)

    projectRow.appendChild(statusDiv)
    projectRow.appendChild(activityDiv)
    projectRow.appendChild(projectNameElement)

    pipelinesContainer.appendChild(projectRow)
  }
  if(projects.length == 0) {
    let projectRow = document.createElement("div")
    projectRow.classList.add("buildkite-project")
    projectRow.innerText = "No pipelines selected"
    pipelinesContainer.appendChild(projectRow)
  }
}