// Get the app manifest in order to determine the location of the API
$.getJSON('manifest.webapp').done(manifest => {
    console.info('Loading app resources');
	
	// Date fields
	var dateFields = ["BV7czmy3DvI-HllvX50cXC0-val", "oNDcK12zz0e-HllvX50cXC0-val"];
	$("#form").hide();

	$("#loading").hide();
	$(".submitandmessage").hide();
	
	dhis2.period.format = 'yyyy-mm-dd';
    dhis2.period.calendar = $.calendars.instance('gregorian');
    dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );
	dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );
	
	// Get the server date
	var serverDate;
	$.getJSON('../../../api/system/info').done(systemInfo => {
		console.log('Server Date: '+systemInfo.serverDate.substring(0, 10));
		serverDate = systemInfo.serverDate.substring(0, 10);
	});
	
	// Set the maximum selectable date
	var maxDate = new Date(dhis2.period.picker.defaults.maxDate.toString());
	maxDate.setDate(maxDate.getDate());
	//$("#reportDate").attr('max',maxDate.toISOString().substring(0,10));
	
	// Set the minimum selectable date
	var minDate = new Date(dhis2.period.picker.defaults.maxDate.toString());
	minDate.setDate(minDate.getDate()-1);
	//$("#reportDate").attr('min',minDate.toISOString().substring(0,10));
	
	$("#reportDateNp").calendarsPicker({
		calendar: $.calendars.instance('nepali'),
		minDate: "",
		maxDate: "0d",
		yearRange: '-120:+0',
		duration: "fast",
	    showAnim: "fadeIn",
		dateFormat: 'yyyy-mm-dd',
		onSelect: function(npDate) {
			var engDate = BS2AD(npDate[0]._year+'-'+npDate[0]._month+'-'+npDate[0]._day);
			$("#reportDate").val(engDate);
			$("#reportDate").trigger("change");
			$('.ui-datepicker-cmd-close').trigger("click");
		}
	});
	
	$("#orgUnit").change(function(){
		$("#loading").hide();
		$("#statusmessage").hide();
		$(".submitandmessage").hide();
		$("#form").hide();
		
		var ouId = $("#orgUnit").val();
		checkOuId(ouId,$("#orgUnitName").val());
	});
	
	$("#reportDate").change(function(){
		var pe = getPeriod();
		var ouId = $("#orgUnit").val();
		
		var dataSet = $("#dataset").val();
		$(".submitandmessage").hide();
		if($("#dataset").val() != "" && $("#orgUnit").val() != ""){
			displayForm(pe, ouId, dataSet);
		}
	});
	
	$("#dataset").change(function(){
		var dataSet = $(this).val();
		var ouId = $("#orgUnit").val();
		
		if($("#reportDate").val() != "" && $("#reportDate").val() != 'undefined'){
			var pe = getPeriod();
			displayForm(pe, ouId, dataSet);
		}
	});
	
	$(document).on("blur", ".form input", function(){
				
		var inputId = $(this).attr("id");
		var value = $(this).val();
		var de = inputId.split('-')[0];
		var co = inputId.split('-')[1];
		var ds = $("#dataset").val();
		var ou = $("#orgUnit").val();
		var pe = getPeriod();
		
		var dataValuesUrl = "/hmisrest/restservice.php?action=dataValues&type=plain";
		var formData = "de="+de+"&co="+co+"&ds="+ds+"&ou="+ou+"&pe="+pe+"&value="+value;
		$.ajax({
			type: "POST",
			url: dataValuesUrl,
			data: formData,
			dataType: 'json',
			beforeSend: function( xhr ) {
				$("#"+inputId).css('background','yellow');
			}, success: function(data){
				$("#loading").hide();
				if(data == null || data.status != 'ERROR'){
					$("#"+inputId).css('background','rgb(185, 255, 185)');
				}else{
					$("#"+inputId).css('background','yellow');
					//console.log(data.message);
					toastr.error(data.message +". Please read the note.",'ERROR');
				}
			}, failure: function(errMsg) {
				//console.log(errMsg);
				toastr.info(errMsg);
				$("#"+inputId).css('background','orange');
				$("#statusmessage").html('<span style="color:red;font-wieght:bold">');
				$("#statusmessage").show();
				$("#loading").hide();
			}
		});
	});
	
	$(document).on("click", "#complete", function(){
		var reportDate = $("#reportDate").val();
		var hf = $("#orgUnit").val();
		
		$.getJSON("https://raw.githubusercontent.com/padamdahal/HMIS-App/master/validation.json", function(validations) {
			var failedValidaitons = {};
			validations = validations[$("#dataset").val()];
			$.each(validations, function(key, validation){
				
				var expressionCompare = {
					'==': function(a, b) { return a == b },
					'>=': function(a, b) { return a >= b },
					'<=': function(a, b) { return a <= b },
					'>': function(a, b) { return a > b },
					'<': function(a, b) { return a < b }
				};
				
				var expression = eval(validation.expression);
				var operator = validation.expectedResult[0];
				var expectedResult = parseInt(validation.expectedResult[1]);
				
				if(expressionCompare[operator](expression, expectedResult) == false){
					failedValidaitons[key] = validation.errorMessage;
				}
			});

			if(Object.keys(failedValidaitons).length > 0){
				var consolidatedMessage = '';
				$.each(failedValidaitons, function(key, message){
					consolidatedMessage += message + "\n";
				})
				alert(consolidatedMessage);
			}else{
				if(reportDate != "" && hf !== "" && hf !== null){
					var completeJson = {
						"completeDataSetRegistrations":[{
							"dataSet":$("#dataset").val(),
							"period":reportDate.substring(0, 4)+reportDate.substring(5, 7)+reportDate.substring(8, 10),
							"organisationUnit":hf
						}]
					};
					
					// Send the POST request to the restservice
					$.ajax({
						type: "POST",
						url: "/hmisrest/restservice.php?action=completeDataSetRegistrations",
						data: JSON.stringify(completeJson),
						dataType: "json",
						beforeSend: function( xhr ) {
							$("#loading").show();
						},
						success: function(data){
							var msg = data.status;
							if(msg == 'SUCCESS'){
								msg = '<span style="color:green;font-wieght:bold">'+msg+'</span>';
							}else if(msg == 'WARNING'){
								msg = '<span style="color:orange;font-wieght:bold">'+msg+'</span>';
							}
							$("#statusmessage").html(msg);
							$("#statusmessage").show();
							$("#loading").hide();
						}, failure: function(errMsg) {
							alert(errMsg);
							$("#statusmessage").html('<span style="color:red;font-wieght:bold">');
							$("#statusmessage").show();
							$("#loading").hide();
						}
					});
				}else{
					alert("Either report date or health facility is missing.");
				}
			}
		});
	});
	
	
	
	function displayForm(pe, ouId, dataSet){
		$("#form").show();
		
		var dhis2UrlParams = "loadForm.action?dataSetId="+dataSet;
					
		var formUrl = '/hmisrest/restservice.php?action=loadForm&dataset='+dataSet;
		$.ajax({
			type: "GET",
			url: formUrl,
			beforeSend: function( xhr ) {
				$("#loading").show();
			}, success: function(data){
				$("#loading").hide();
				$(".form").html(data);
				getDataValues(pe,ouId,dataSet);
				triggerNepaliCalendar();
				$(".submitandmessage").show();
				
			}, failure: function(errMsg) {
				alert(errMsg);
				$("#statusmessage").html('<span style="color:red;font-wieght:bold">');
				$("#statusmessage").show();
				$(".submitandmessage").hide();
				$("#loading").hide();
			}
		});
	}
	
	function triggerNepaliCalendar(){
		$("td.date input").calendarsPicker({
			calendar: $.calendars.instance('nepali'),
			yearRange: '-120:+0',
			duration: "fast",
			showAnim: "fadeIn",
			dateFormat: 'yyyy-mm-dd',
			onSelect: function(npDate) {
				$(this).trigger("blur");
			}
		});
	}
	
	function loadAvailableDataSets(ouId){
		$("#dsmsg").html('Please wait...');
		var url = '/hmisrest/restservice.php?ouDatasetAssignment='+ouId;
		$.ajax({
			type: "GET",
			url: url,
			dataType: "json",
			success: function(dataSetAssignment){
				var url = '/hmisrest/restservice.php?action=dataSets';
				$.ajax({
					type: "GET",
					url: url,
					dataType: 'json',
					success: function(data){
						$("#dataset").empty();
						$("#dataset").append('<option value="">Select data set</option>');
						$.each(data.dataSets, function(i, ds ) {
							if(dataSetAssignment.includes(ds.id)){
								$("#dataset").append('<option value=' + ds.id + '>' + ds.displayName + '</option>');
							}
						});
						$("#dsmsg").html('');
					}, failure: function(errMsg) {
						console.log(errMsg);
					}
				});
			}
		});
	}
	
	function getDataValues(pe,ouId,dataSet){
		$.ajax({
			type: "GET",
			url: "/hmisrest/restservice.php?reportDate="+pe+"&ouId="+ouId+"&dataSet="+dataSet,
			dataType: "json",
			success: function(data){
				if(data.dataValues.length > 0){
					$.each(data.dataValues, function(i, item){
						var id = item.id+"-val";
						var val = item.val;
						$("#"+id).val(val);
					});
				}else{
					$(".inputFields").val("");
				}
				if(data.complete == true){
					alert('Data set already completed for this period.');
					$("#statusmessage").show();
					$("#statusmessage").html('Completed on '+data.date);
				}
			}, failure: function(errMsg) {
				console.log(errMsg);
			}
		});	
	}
	
	function getPeriod(){
		var reportDate = $("#reportDate").val();
		return reportDate.substring(0, 4)+reportDate.substring(5, 7)+reportDate.substring(8, 10);
	}
	
	function getReport(ouid){
		//console.log(ouid);
		$.ajax({
			type: "GET",
			url: "/hmisrest/restservice.php?ouReport="+ouid,
			dataType: "json",
			success: function(data){
				var renderers = $.extend($.pivotUtilities.renderers,$.pivotUtilities.c3_renderers);
				var sum = $.pivotUtilities.aggregatorTemplates.sum;
                var numberFormat = $.pivotUtilities.numberFormat;
                var intFormat = numberFormat({digitsAfterDecimal: 0}); 
				var tpl = $.pivotUtilities.aggregatorTemplates;
				$("#report").pivotUI(data,{
					renderers: renderers,
					hiddenFromDragDrop: ["Value"],
					cols: ["Period"],
					rows: ["Data"],
					aggregators: {
						"Sum of Values": function() { return tpl.sum()(["Value"]) }
					}
					
				},true);
			}, failure: function(errMsg) {
				console.log(errMsg);
			}
		});	
	}
	
	function checkOuId(ouId,ouName){
		// try to get the details from another instance firstChild
		$("#dsmsg").html('Please wait...');
		$.getJSON("/hmisrest/hmisAdditionalAdapter.php?action=getOuDetail&ouid="+ouId).done(ouDetail => {
			if(ouDetail.status === undefined){
				console.log('ouid match');
				loadAvailableDataSets(ouId);
				$("#dsmsg").html('');
			}else{
				console.log("Searching for matching ouid..." );
				$.getJSON("/hmisrest/hmisAdditionalAdapter.php?action=getAllOu").done(ous => {
					$.each(ous.organisationUnits, function(i, ou ) {
						if(ou.name == ouName){
							console.log('found: '+ou.id);
							document.getElementById('orgUnit').value = ou.id;
							loadAvailableDataSets(ou.id);
							$("#dsmsg").html('');
							return false;
						}
					});
				});
			}
			
		}).fail(function() {
			
		});
	}
}).fail(error => {
	console.warn('Failed to get manifest:', error);
});