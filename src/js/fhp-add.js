
const DHIS2_BASE_URL = "https://hmis.gov.np/hmisadditional";
const AUTH = "Basic YWRtaW46SG1pc0A5MDA5";
const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const programInfo = params.get('program');

const metaData = '';
const uploadedFiles = {};

async function fetchMetadata() {
	const program = programInfo.split("-")[0];
	const programStage = programInfo.split("-")[1];
		const url = `${DHIS2_BASE_URL}/api/programStages/${programStage}?fields=
id,name,programStageSections[id,name,sortOrder,dataElements[id]],
programStageDataElements[sortOrder,compulsory,displayInReports,dataElement[id,name,shortName,formName,displayShortName,valueType,description,optionSet[id]]]`;
		const res = await fetch(url, {
				headers: { "Authorization": AUTH }
		});
		return await res.json();
}

async function fetchOptionSets(ids) {
		if (!ids.length) return {};
		const url = `${DHIS2_BASE_URL}/api/optionSets?filter=id:in:[${ids.join(",")}]&fields=id,options[code,name]`;
		const res = await fetch(url, {
				headers: { "Authorization": AUTH }
		});
		const data = await res.json();
		let map = {};
		data.optionSets.forEach(os => {
				map[os.id] = os.options;
		});
		return map;
}

function getLabel(de) {
		return de.formName || de.displayShortName || de.shortName || de.name;
}

function generateField(de, optionSets, compulsory) {
		const id = `${de.id}_field`;
	const required = (compulsory)?'required':'';

		if (de.optionSet) {
				const options = optionSets[de.optionSet.id] || [];
				let html = `<select id="${id}">
												<option value="">Select</option>`;

				options.forEach(opt => {
						html += `<option value="${opt.code}">${opt.name}</option>`;
				});
				html += `</select>`;
				return html;
		}

		switch (de.valueType) {
				case "TEXT":
				case "LONG_TEXT":
						return `<input type="text" id="${id}" ${required}>`;
				case "NUMBER":
			return `<input type="number" id="${id}" ${required}>`;
				case "INTEGER":
						return `<input type="number" id="${id}" ${required}>`;
		case "INTEGER":
			return `<input type="number" id="${id}" ${required}>`;
		case "INTEGER_POSITIVE":
			return `<input type="number" id="${id}" ${required}>`;
				case "DATE":
						return `<input type="date" id="${id}" ${required}>`;
				case "TRUE_ONLY":
						return `<input type="checkbox" id="${id}" ${required}>`;
				case "PHONE_NUMBER":
						return `<input type="tel" id="${id}" maxlength="10" pattern="[0-9]{10}" minlength="10" ${required}>`;
		case "FILE_RESOURCE":
						return `<input type="file" id="${id}" ${required}>`;
				default:
						return `<input type="text" id="${id}" ${required}>`;
		}
}

async function buildForm() {
	const program = programInfo.split("-")[0];
	const programStage = programInfo.split("-")[1];

		const container = document.getElementById("form-container");
	container.innerHTML = "";

		try {
				metadata = await fetchMetadata(programStage);
				let elements = metadata.programStageDataElements.sort(
						(a, b) => a.sortOrder - b.sortOrder
				);
				// OptionSet IDs
				const optionSetIds = elements
						.map(e => e.dataElement.optionSet?.id)
						.filter(Boolean);
				const optionSets = await fetchOptionSets(optionSetIds);
				let html = "";

				// Render by Sections
				if (metadata.programStageSections?.length) {
						const sections = metadata.programStageSections.sort(
								(a, b) => a.sortOrder - b.sortOrder
						);

						sections.forEach(section => {
								html += `<div class="section-title">${section.name}</div>`;
								section.dataElements.forEach(ref => {
										const item = elements.find(e => e.dataElement.id === ref.id);
										if (!item) return;
										const de = item.dataElement;
										const label = getLabel(de);

										html += `<div class="form-row">`;
										html += `<label title="${de.description || ""}">
																${label}
																${item.compulsory ? '<span class="required">*</span>' : ''}
														 </label>`;
										html += generateField(de, optionSets, item.compulsory);
										html += `</div>`;
								});
						});
				}else{
						// fallback if no sections
						elements.forEach(item => {
								const de = item.dataElement;
								const label = getLabel(de);
								html += `<div class="form-row">`;
								html += `<label>
														${label}
														${item.compulsory ? '<span class="required">*</span>' : ''}
												 </label>`;
								html += generateField(de, optionSets);
								html += `</div>`;
						});
				}
				html += `<button id="btn-submit" class="btn-submit" onclick="submitEvent()">Submit</button>`;
				container.innerHTML = html;
		attachFileListeners();
		} catch (err) {
				console.error(err);
				container.innerHTML = "Failed to load form";
		}
}

async function uploadFileToDHIS2(file) {
		const formData = new FormData();
		formData.append("file", file);
		const res = await fetch(`${DHIS2_BASE_URL}/api/fileResources`, {
				method: "POST",
				headers: {
						"Authorization": AUTH
				},
				body: formData
		});

		const result = await res.json();
		if (!res.ok) {
				console.error("File upload failed:", result);
				throw new Error("File upload failed");
		}
		return result.response.fileResource.id;
}

async function submitEvent() {
	var eventStatus = 'ACTIVE';
	const submitBtn = document.getElementById("btn-submit");
	submitBtn.disabled = true;

	if (!validateForm(metadata)) {
		submitBtn.disabled = false;
				return;
		}

		const elements = metadata.programStageDataElements;
		let dataValues = [];

		elements.forEach(item => {
				const de = item.dataElement;
				const el = document.getElementById(`${de.id}_field`);
				if (!el) return;
				let value = '';

				if (el.type === "checkbox") {
			if (el.checked) {
				value = 'true';
				if(de.id === "DsZjWisWVZn"){
					eventStatus = "COMPLETED";
				}
			}
				}else if(el.type === 'file'){
			const fileId = uploadedFiles[de.id];
						if (fileId) {
								value = fileId
						}
		}else{
						value = el.value;
				}

				if (value !== "") {
						dataValues.push({
								dataElement: de.id,
								value: value
						});
				}
		});
	const program = programInfo.split("-")[0];
	const programStage = programInfo.split("-")[1];
		const payload = {
				events: [{
						program: program,
						programStage: programStage,
						orgUnit: selectedOrgUnit,
						eventDate: new Date().toISOString().split("T")[0],
						status: eventStatus,
						dataValues: dataValues
				}]
		};

		try {
				const res = await fetch(`${DHIS2_BASE_URL}/api/events`, {
						method: "POST",
						headers: {
								"Authorization": AUTH,
								"Content-Type": "application/json"
						},
						body: JSON.stringify(payload)
				});

				const result = await res.json();

				if (res.ok) {
						alert("Event submitted successfully");
			resetForm();
			submitBtn.disabled = false;
				} else {
						console.error(result);
						alert("Submission failed");
			submitBtn.disabled = false;
				}

		} catch (err) {
				console.error(err);
		}
}

	// Select organization unit
var selectedOrgUnit;
selection.setListenerFunction(function(e){
	selectedOrgUnit = e;
	var selectedOrgUnitName = document.getElementsByClassName("selected")[0].innerHTML;
	document.getElementById('orgUnitName').value = selectedOrgUnitName;
	document.getElementById('orgUnit').value = e[0];
	$("#orgUnit").trigger("change");
		checkOuId(e[0],selectedOrgUnitName);
});

// Organization Unit search
$("#searchField").autocomplete({
	source: "/dhis-web-commons/ouwt/getOrganisationUnitsByName.action",
	select: function(event,ui) {
		$("#searchField").val(ui.item.value);
		selection.findByName();
	}
});

async function checkOuId(ouId,ouName){
		// try to get the details from another instance firstChild
		let ouIdToReturn;
		var url = `${DHIS2_BASE_URL}/api/organisationUnits/${ouId}?fields=id,name,level`;
		const res = await fetch(url, {
				headers: { "Authorization": AUTH }
		});
		const data = await res.json();
		if(data.status === undefined){
				console.log("OU ID Match");
				ouIdToReturn = ouId;
		}else{
			// Check OU By Name
			var url = `${DHIS2_BASE_URL}/api/organisationUnits?filter=name:like:${ouName}&paging=false`;
			const res = await fetch(url, {
				headers: { "Authorization": AUTH }
			});
			const data = await res.json();
				if(data.organisationUnits != undefined){
						console.log('OU name match');
						console.log(data.organisationUnits[0].id);
						ouIdToReturn = data.organisationUnits[0].id;
						selectedOrgUnit = ouIdToReturn;
				}else{
						alert("Hospital doesn't exists in target system.")
						selectedOrgUnit = null;
				}
		}
		console.log("Remote orgUnitId = "+ouIdToReturn);

}

function attachFileListeners() {
		const fileInputs = document.querySelectorAll('input[type="file"]');
		fileInputs.forEach(input => {
				input.addEventListener("change", async function() {
						if (!this.files.length) return;
						const file = this.files[0];
						const dataElement = this.id.split("_")[0];
						// UI feedback
						this.disabled = true;
						try {
								const fileId = await uploadFileToDHIS2(file);
								// Store fileResourceId
								uploadedFiles[dataElement] = fileId;
								// Optional UI feedback
								this.style.border = "2px solid green";
								this.title = "Uploaded";
								console.log("Uploaded:", dataElement, fileId);
						} catch (err) {
								alert("File upload failed");
								this.value = "";
						}
						this.disabled = false;
				});
		});
}

function validateForm(metadata) {
		const elements = metadata.programStageDataElements;

		for (let item of elements) {
				if (!item.compulsory) continue;
				const de = item.dataElement;
				const el = document.getElementById(`${de.id}_field`);
				if (!el) continue;

				let isValid = true;

				if(el.type === "file") {
						if (!uploadedFiles[de.id]) {
								isValid = false;
						}
				}else if (el.type === "checkbox") {
						if (!el.checked) {
								isValid = false;
						}
				}else if (el.type === "tel") {
						if (el.value.length !== 10) {
				alert('Phone number must be exactly 10 digits');
				isValid = false;
			}
				}else {
						if (!el.value || el.value.trim() === "") {
								isValid = false;
						}
				}

				if (!isValid) {
						const label = getLabel(de);
						alert(label + " is required");
						el.focus();
						return false;
				}
		}
		return true;
}

function resetForm() {
		const container = document.getElementById("form-container");
		// Reset all inputs/selects/textarea
		const elements = container.querySelectorAll("input, select, textarea");

		elements.forEach(el => {
				if (el.type === "checkbox") {
						el.checked = false;
				}else if (el.type === "file") {
						el.value = "";
						el.style.border = "";
						el.title = "";
				} else {
						el.value = "";
				}
				// Remove validation highlight (if you added)
				el.style.border = "";
		});

		// Clear uploaded file IDs
		for (let key in uploadedFiles) {
				delete uploadedFiles[key];
		}

		console.log("Form reset complete");
}

buildForm();