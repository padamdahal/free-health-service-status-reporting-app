const DHIS2_BASE_URL = "https://hmis.gov.np/hmisadditional";
const AUTH = "Basic YWRtaW46SG1pc0A5MDA5";

var metadata;
var program;
var programStage;
var orgUnit;
const uploadedFiles = {};

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const eventId = params.get('eventId');

buildForm();


async function fetchMetadata(programStage) {
	const url = `${DHIS2_BASE_URL}/api/programStages/${programStage}?fields=
		id,name,programStageSections[id,name,sortOrder,dataElements[id]],
		programStageDataElements[sortOrder,compulsory,displayInReports,dataElement[
				id,name,shortName,formName,displayShortName,valueType,description,optionSet[id]]]`;
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

function generateField(de,optionSets,compulsory,dataValue) {
	const id = `${de.id}_field`;
	var required = (compulsory)?'required':'';
	var value;

	if(dataValue){
		value = dataValue.value;
	}else{
		value = null;
	}
	if (de.optionSet) {
		const options = optionSets[de.optionSet.id] || [];
		let html = `<select id="${id}">
						<option value="">Select</option>`;

		options.forEach(opt => {
			html += `<option value="${opt.code}" ${opt.code === value ? "selected" : ""}>${opt.name}</option>`;
		});
		html += `</select>`;
		return html;
	}

	switch (de.valueType) {
		case "TEXT":
		case "LONG_TEXT":
			return `<input type="text" id="${id}" value="${value}" ${required}>`;
		case "NUMBER":
			return `<input type="number" id="${id}" value="${value}" ${required}>`;
		case "INTEGER":
			return `<input type="number" id="${id}" value="${value}" ${required}>`;
		case "INTEGER_POSITIVE":
			return `<input type="number" id="${id}" value="${value}" ${required}>`;
		case "DATE":
			return `<input type="date" id="${id}" value="${value}" ${required}>`;
		case "TRUE_ONLY":
			return `<input type="checkbox" id="${id}" ${value === 'true' ? "checked" : ""} ${required}>`;
		case "PHONE_NUMBER":
			return `<input type="tel" id="${id}" maxlength="10" pattern="[0-9]{10}" minlength="10" value="${value}" ${required}>`;
		case "FILE_RESOURCE":
			var html;
			if(value != null){
				const file = `${DHIS2_BASE_URL}/api/events/files?eventUid=${eventId}&dataElementUid=${de.id}`;
				html = `<div><a id="${de.id}_currentDoc" href="${file}">View current document</a> <a href='#'>X</a></div>
				<input type="hidden" id="${id}" value="${value}" ${required}>`
			}else{
				html = `<input type="file" id="${id}" ${required}>`;
			}
			return html;
		default:
			return `<input type="text" id="${id}" value="${value}" ${required}>`;
	}
}

async function buildForm() {
	const res = await fetch(
		`${DHIS2_BASE_URL}/api/events/${eventId}.json`,
		{ headers: { Authorization: AUTH } }
	);
	const eventData = await res.json();


	program = eventData.program;
	programStage = eventData.programStage;
	orgUnit = eventData.orgUnit;
	const dataValues = eventData.dataValues;

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

					const dataValue = dataValues.find(dv => dv.dataElement === de.id) || {};
					if (!dataValue){
						dataValue = null
					}
					const label = getLabel(de);

					html += `<div class="form-row">`;
					html += `<label title="${de.description || ""}">
								${label}
								${item.compulsory ? '<span class="required">*</span>' : ''}
							 </label>`;
					html += generateField(de,optionSets,item.compulsory,dataValue);
					html += `</div>`;
				});
			});
		}else{
			// fallback if no sections
			elements.forEach(item => {
				const de = item.dataElement;
				const label = getLabel(de);
				const dataValue = dataValues.find(dv => dv.dataElement === de) || {};
				if (!dataValue){
					dataValue = null
				}
				html += `<div class="form-row">`;
				html += `<label>
							${label}
							${item.compulsory ? '<span class="required">*</span>' : ''}
						 </label>`;
				html += generateField(de,optionSets,item.compulsory,dataValue);
				html += `</div>`;
			});
		}
		html += `<button class="btn-submit" onclick="submitEvent()">Submit</button>`;
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

	if (!validateForm(metadata)) {
		submitBtn.disabled = false;
		return;
	}
	var eventStatus = 'ACTIVE';

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

	const payload = {
		event: eventId,
		program: program,
		programStage: programStage,
		orgUnit: orgUnit,
		status: eventStatus,
		dataValues: dataValues
	};

	try {
		const res = await fetch(`${DHIS2_BASE_URL}/api/events/${eventId}`, {
			method: "PUT",
			headers: {
				"Authorization": AUTH,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		});

		const result = await res.json();

		if (res.ok) {
			alert("Event submitted successfully");
			redirectToListView(program+"-"+programStage);
		} else {
			console.error(result);
			alert("Submission failed");
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
});

// Organization Unit search
$("#searchField").autocomplete({
	source: "/dhis-web-commons/ouwt/getOrganisationUnitsByName.action",
	select: function(event,ui) {
		$("#searchField").val(ui.item.value);
		selection.findByName();
	}
});

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

function redirectToListView(program) {
	window.location.href = "index.html?program="+program;
}