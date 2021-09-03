chrome.storage.onChanged.addListener(function (changes, namespace) {
  chrome.storage.sync.get(null, (data) => {
    if(changes.hasOwnProperty(`${data.buildkiteOrganizationSlug}-projectData`)) {
      let projectData = changes[`${data.buildkiteOrganizationSlug}-projectData`].newValue
      rebuildProjectList(projectData)
    }
  })
})

chrome.storage.sync.get(null, (data) => {
  let projectData = data[`${data.buildkiteOrganizationSlug}-projectData`]
  rebuildProjectList(projectData)
})


async function rebuildProjectList(projects) {
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

    let projectNameElement = document.createElement("p")
    projectNameElement.classList.add("project-name")
    projectNameElement.innerText = projectName

    let activityDiv = document.createElement("div")
    activityDiv.classList.add("project-activity")
    activityDiv.classList.add(`${activity.toLowerCase()}`)

    projectRow.appendChild(statusDiv)
    projectRow.appendChild(activityDiv)
    projectRow.appendChild(projectNameElement)

    pipelinesContainer.appendChild(projectRow)
  }
}