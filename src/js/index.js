
	const DHIS2_BASE_URL = "https://hmis.gov.np/hmisadditional";
	const AUTH = "Basic YWRtaW46SG1pc0A5MDA5";
	var selectedEvent;

	const queryString = window.location.search;
	const params = new URLSearchParams(queryString);
	const programInfo = params.get('program');
	const reportType = document.querySelector('#reportType');

	if(programInfo){
		reportType.value = programInfo; 
	}

	async function fetchMetadata(programStage) {
		const url = `${DHIS2_BASE_URL}/api/programStages/${programStage}?fields=
			programStageDataElements[displayInReports,compulsory,dataElement[
					id,name,formName,shortName,displayShortName,valueType]]`;
		const res = await fetch(url, { headers: { Authorization: AUTH } });
		return await res.json();
	}

	function getLabel(de) {
		return de.formName || de.displayShortName || de.shortName || de.name;
	}

	async function loadEvents() {
		const PROGRAM_STAGE = document.getElementById("reportType").value.split("-")[1];
		let ORG_UNIT = document.getElementById('orgUnit').value;
		ORG_UNIT = await checkOuId(ORG_UNIT, document.getElementById('orgUnitName').value);
		console.log
		const metadata = await fetchMetadata(PROGRAM_STAGE);
		const elements = metadata.programStageDataElements;
		const reportElements = elements.filter(e => e.displayInReports);

		const res = await fetch(
			`${DHIS2_BASE_URL}/api/events.json?programStage=${PROGRAM_STAGE}&orgUnit=${ORG_UNIT}&paging=false&fields=event,eventDate,dataValues[dataElement,value]`,
			{ headers: { Authorization: AUTH } }
		);

		const data = await res.json();
		let html = `<table id="dataTable">
			<tr>
				<th>Date</th>`;
		reportElements.forEach(e => {
			html += `<th>${getLabel(e.dataElement)}</th>`;
		});

		html += `<th>Action</th></tr>`;
		if(data.events.length > 0){
			data.events.forEach(ev => {
				console.log(ev);
				html += `<tr><td>${ev.eventDate}</td>`;
				reportElements.forEach(e => {
					const dv = ev.dataValues.find(d => d.dataElement === e.dataElement.id);
					html += `<td>${dv ? dv.value : ""}</td>`;
				});
				var dischargeBtn = "";
				var dv = ev.dataValues.find(d => d.dataElement === 'DsZjWisWVZn');
				if(PROGRAM_STAGE != 'g0d1go4MmzA'){
					if(!dv || !dv.value || dv.value == false){
					dischargeBtn = `<button onclick="openEditModal('${ev.event}')">Discharge</button>`;
					}else{
					dischargeBtn = `<button disabled>Discharged</button>`;
					}
				}
				html += `<td>${dischargeBtn} <a class="edit-button" href="fhp-edit.html?eventId=${ev.event}">Edit</a></td></tr>`;
			});
		}

		html += `</table>`;
		document.getElementById("event-list").innerHTML = html;

		// Hide add new button for one time information
		if(PROGRAM_STAGE == 'g0d1go4MmzA'){
			if(data.events.length != 0){
				document.getElementById("addNew").style.display = "none";
			}
		}

		// Check if hospital data is entered
		if(PROGRAM_STAGE == 'f0C1TB9k2x6'){
			const resTemp = await fetch(
				`${DHIS2_BASE_URL}/api/events.json?programStage=g0d1go4MmzA&orgUnit=${ORG_UNIT}&paging=false&fields=event,eventDate,dataValues[dataElement,value]`,
				{ headers: { Authorization: AUTH } }
			);

			const dataTemp = await resTemp.json();
			if(dataTemp.events.length == 0){
				document.getElementById("addNew").style.display = "none";
				alert("Enter hospital information first");
			}
		}
	}

	async function openEditModal(eventId) {
		selectedEvent = eventId;
		const res = await fetch(`${DHIS2_BASE_URL}/api/events/${eventId}?fields=*`, {
			headers: { Authorization: AUTH }
		});
		const event = await res.json();


		const hiddenContainer = document.getElementById('hiddenDataValues');
		hiddenContainer.innerHTML = '';

		const PROGRAM_STAGE = document.getElementById("reportType").value.split("-")[1];
		const metadata = await fetchMetadata(PROGRAM_STAGE);

		// OptionSet IDs
		const optionSetIds = metadata.programStageDataElements
			.map(e => e.dataElement.optionSet?.id)
			.filter(Boolean);
		const optionSets = await fetchOptionSets(optionSetIds);

		let html = "";

		metadata.programStageDataElements.forEach(item => {
			const de = item.dataElement;
			const isEditable = de.id === "DsZjWisWVZn"||de.id === "oBhJ0aWNjmL"||de.id === "NE44z9pVewW";

			const existing = event.dataValues.find(d => d.dataElement === de.id)||{};

			if (isEditable){
				const label = getLabel(de);
				const id = `${de.id}_edit`;

				//const existing = event.dataValues.find(d => d.dataElement === de.id);
				html += `<div class="form-row">
					<label>${label}</label>`;
				if (de.optionSet) {
					const options = optionSets[de.optionSet.id] || [];
					let html = `<select id="${id}">
						<option value="">Select</option>`;
					options.forEach(opt => {
						html += `<option value="${opt.code}" ${opt.code === existing.value ? "selected" : ""}>${opt.name}</option>`;
					});
					html += `</select>`;
				}

				switch (de.valueType) {
					case "TEXT":
					case "LONG_TEXT":
						html += `<input type="text" id="${id}" value="${existing ? existing.value : ""}">`;
						break;
					case "NUMBER":
						html += `<input type="number" id="${id}" value="${existing ? existing.value : ""}">`;
						break;
					case "INTEGER":
						html += `<input type="number" id="${id}" value="${existing ? existing.value : ""}">`;
						break;
					case "DATE":
						html += `<input type="date" id="${id}" value="${existing ? existing.value : ""}">`;
						break;
					case "TRUE_ONLY":
						html += `<input type="checkbox" id="${id}" ${existing.value ? "checked" : ""}>`;
						break;
					case "PHONE_NUMBER":
						html += `<input type="tel" id="${id}" value="${existing ? existing.value : ""}">`;
						break;
					case "FILE_RESOURCE":
						html += `<input type="file" id="${id}">`;
						break;
					default:
						html += `<input type="text" id="${id}" value="${existing ? existing.value : ""}">`;
				}
				html += `</div>`;
			}else{
				const input = document.createElement('input');
				input.type = 'hidden';
				input.id = `${de.id}_edit`;
				input.value = existing.value || '';
				hiddenContainer.appendChild(input);
			}
		});

		document.getElementById("edit-form").innerHTML = html;
		document.getElementById("modal").style.display = "block";
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

	async function uploadFile(file) {
		const formData = new FormData();
		formData.append("file", file);
		const res = await fetch(`${DHIS2_BASE_URL}/api/fileResources`, {
			method: "POST",
			headers: { Authorization: AUTH },
			body: formData
		});
		const result = await res.json();
		if (!res.ok) throw new Error("Upload failed");
		return result.response.fileResource.id;
	}

	async function submitUpdate() {
		let ORG_UNIT = document.getElementById('orgUnit').value;
		ORG_UNIT = await checkOuId(ORG_UNIT, document.getElementById('orgUnitName').value);
		const PROGRAM = document.getElementById("reportType").value.split("-")[0];
		const PROGRAM_STAGE = document.getElementById("reportType").value.split("-")[1];
		const metadata = await fetchMetadata(PROGRAM_STAGE);
		let dataValues = [];
		var eventStatus = 'ACTIVE';

		for (let item of metadata.programStageDataElements) {
			const de = item.dataElement;
			const el = document.getElementById(`${de.id}_edit`);
			if (!el) continue;
			let value = '';

			if (el.type === "file" && el.files.length) {
				const fileId = await uploadFile(el.files[0]);
				dataValues.push({
					dataElement: de.id,
					value: fileId
				});
			}else if (el.type === "checkbox") {
				if (el.checked){
					value = 'true';
					dataValues.push({
						dataElement: de.id,
						value: "true"
					});

					if(de.id === "DsZjWisWVZn"){
						eventStatus = "COMPLETED";
					}
				}				
			}else if (el.value) {
				dataValues.push({
					dataElement: de.id,
					value: el.value
				});
			}
		}

		const payload = {
			event: selectedEvent,
			program: PROGRAM,
			programStage: PROGRAM_STAGE,
			orgUnit: ORG_UNIT,
			status: eventStatus,
			dataValues: dataValues
		};

		//console.log(payload);
		const res = await fetch(`${DHIS2_BASE_URL}/api/events/${selectedEvent}`, {
			method: "PUT",
			headers: {
				Authorization: AUTH,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		});

		if (res.ok) {
			alert("Updated successfully");
			closeModal();
			loadEvents();
		} else {
			alert("Update failed");
		}
	}

	async function checkOuId(ouId,ouName){

		let ouIdToReturn;
		// Check OU by Id in additional instance
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
				ouIdToReturn = data.organisationUnits[0].id;
			}	
		}
		return ouIdToReturn;
	}

	function closeModal() {
		document.getElementById("modal").style.display = "none";
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

	// Select organization unit
	var selectedOrgUnit;
	selection.setListenerFunction(function(e){
		selectedOrgUnit = e;
		var selectedOrgUnitName = document.getElementsByClassName("selected")[0].innerHTML;
		document.getElementById('orgUnitName').value = selectedOrgUnitName;
		document.getElementById('orgUnit').value = e[0];
		loadEvents();
	});

	// Organization Unit search
	$("#searchField").autocomplete({
		source: "/dhis-web-commons/ouwt/getOrganisationUnitsByName.action",
		select: function(event,ui) {
			$("#searchField").val(ui.item.value);
			selection.findByName();
		}
	});

	// Report type selector	
	reportType.addEventListener('change', (event) => {
		document.getElementById("event-list").innerHTML = "<img src='img/pulse.gif'/>";
		document.getElementById("addNew").style.display = "block";
		loadEvents();
	});

	const newEntryLink = document.querySelector('#addNew');
	newEntryLink.addEventListener('click', (event) => {
		event.preventDefault();
		let href = newEntryLink.getAttribute('href');
		const reportType = document.getElementById("reportType").value;
		const basePath = window.location.origin + window.location.pathname.replace(/[^\/]+$/, '');
		const url = `${basePath}fhp-add.html?program=${encodeURIComponent(reportType)}`;
		window.location.href = url;
	});

	// Init
	loadEvents();

	$(document).ready(function(){
		if ($.fn.DataTable.isDataTable('dataTable')) {
			$('#eventTable').DataTable().destroy();
		}


		$('#dataTable').DataTable();

	})