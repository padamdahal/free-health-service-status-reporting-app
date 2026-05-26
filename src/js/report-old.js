// Get the app manifest in order to determine the location of the API
$.getJSON('manifest.webapp').done(manifest => {
    console.info('Loading app resources');
	
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
	
	var reportType = "reporting";
	
	// Select organization unit
	var ouId;
	var selectedOrgUnit;
	var selectedOrgUnitLevel;
	var selectedOrgUnitName;
	
	selection.setListenerFunction(function(e){
		selectedOrgUnit = e;
		selectedOrgUnitName = document.getElementsByClassName("selected")[0].innerHTML;
		
		ouId = e[0];
		if(hmisOu.includes(ouId)){
			ouId = hmisAdditionalOu[hmisOu.indexOf(ouId)];
		}
		$.getJSON("../../../api/organisationUnits/"+ouId+".json", function(ouDetail) {
			var ouLevel = ouDetail.level;
			$("#selectedOrgUnit").html(selectedOrgUnitName);
			$("#visualization").load('https://raw.githubusercontent.com/padamdahal/HMIS-App/master/report-parts.html');
			getReport(ouId, ouLevel, reportType);
		});
	});
	
	// Organization Unit search
	$("#searchField").autocomplete({
		source: "../../../dhis-web-commons/ouwt/getOrganisationUnitsByName.action",
		select: function(event,ui) {
			$("#searchField").val(ui.item.value);
			selection.findByName();
		}
	});
	
	function getReport(ouid, ouLevel, reportType){
		var dx;
		var ou;
		$.getJSON("https://raw.githubusercontent.com/padamdahal/HMIS-App/master/config.json", function(configs) {
			$(".card-body").empty();
			$(".card-body").html("<img src='pulse.gif' style='height:50px;margin:10px;' />");
			$(".card h3").html("<img src='pulse.gif' style='height:20px;margin:3px;' />");
			
			$.each(configs, function(key, config){
				var name = key;
				var config = config.config;
				var titleWithDownloadLink = config.title+" <a style='margin-left:15px;' title='Download Data' href='#' class='download' target="+name+"><img src='download.png' style='width:20px;'/></a>";
				$("#"+name+"-title").html(titleWithDownloadLink);
				
				if(config.ouLevel == 'subLevel' && ouLevel <= 3){
					ou = ouId+";LEVEL-"+(ouLevel+1);
				}else if(config.ouLevel == 'selected'){
					ou = ouId;
				}else if(config.ouLevel == '+subLevel'){
					ou = ouId+";LEVEL-"+(ouLevel+1)+";LEVEL-"+ouLevel;
				}else{
					ou = ouId+";"+config.ouLevel;
				}
				
				$.getJSON("/hmisrest/covacdaily.php?type="+reportType+"&ou="+ou+"&dx="+config.dx+"&pe="+config.pe, function(data) {
					if(config.visualizationType == 'number'){
						var d;
						if(data[0] == undefined){
							d = 0;
						}else{
							d = Math.round(data[0].Value);
						}	
						$("#"+name).html(d);
					}else if (config.visualizationType == 'map'){
						mapify(name, config, data);
					}else{
						var renderers = $.pivotUtilities.plotly_renderers[config.visualizationType];
						var width = $("body #"+name).width();
						var chartTitle = config.title;
						var sum = $.pivotUtilities.aggregatorTemplates.sum;
						var numberFormat = $.pivotUtilities.numberFormat;
						var intFormat = numberFormat({digitsAfterDecimal: 0});
						var aggregator;
						if(config.aggregator == "sum"){
							aggregator = sum(intFormat)(["Value"]);
						}else{
							aggregator = null;
						}
						
						$("#"+name).pivot(data, {
							rows: config.rows,
							cols: config.cols,
							renderer: renderers,
							aggregator: aggregator,
							rendererOptions: { plotly: {responsive:true, xaxis:config.xaxis, yaxis:config.yaxis, title:chartTitle}}
						});
						
						if(config.hide.includes('colTotal')){
							$("#"+name+" table th.pvtColTotalLabel").css('display','none');
							$("#"+name+" table td.colTotal").css('display','none');
							$("#"+name+" table td.pvtGrandTotal").css('display','none');
						}
						
						if(config.hide.includes('rowTotal')){
							$("#"+name+" table th.pvtRowTotalLabel").css('display','none');
							$("#"+name+" table td.rowTotal").css('display','none');
							$("#"+name+" table td.pvtGrandTotal").css('display','none');
						}
					}
				});
			});
		});
	}
	
	// Map section
	function mapify(name, config, data){
		$("#"+name).css("height",'91%');
		$("#"+name).css("background",'#efefef');
		$("#"+name).html("");
			var map = L.map(name).setView([28.3, 84.3], 7);
			
			var geojson;
			
			$.ajax({
				url: 'geojson/'+selectedOrgUnitName.replaceAll(" ", "")+'.json'
			}).done(function(geoJson) {					
				geojson = L.geoJson(geoJson, {
					style: style,
					onEachFeature: onEachFeature
				}).addTo(map);
				map.fitBounds(geojson.getBounds());
			});
			
			map.attributionControl.addAttribution('COVID-19 Vaccination Statistics &copy; <a href="#">IHIMS</a>');
			
			function getFeatureData(featureName){
				var featureData = 0;
				$.each(data, function(i, d){
					if(d["Organisation unit"].substring(4, 100) == featureName){
						featureData = parseInt(d["Value"]);
					}
				});
				return featureData;
			}
			
			// control that shows district info on hover
			var info = L.control();
			info.onAdd = function (map) {
				this._div = L.DomUtil.create('div', 'info');
				this.update();
				return this._div;
			};

			info.update = function (props) {
				var labelInfo = 0;
				var name;
				if(typeof(props) !== 'undefined' && typeof(props.TARGET) !== 'undefined'){
					labelInfo = getFeatureData(props.TARGET);
					name = props.TARGET
				}
				this._div.innerHTML = (props?'<h4 style="background:none;padding:5px;border:1px solid #eee;">' + name + ': '+labelInfo+'</h4>':"");
			};
			info.addTo(map);
			
			/*
			// get color depending on population density value
			function getColor(value) {
				var d = value;
				if(d == 0){
					return '#e1f2d9'; 
				}else{
					return d > 200 ? '#800026' :
						d > 100  ? '#BD0026' :
						d > 50  ? '#E31A1C' :
						d > 20  ? '#FC4E2A' :
						d > 10  ? '#FC9E2A' :
						'#FFEDA0';
				}
			}*/
			
			function getColor(value) {
				var d = value;
				if(d == 0){
					return 'white'; 
				}else{
					return d > 200  ? 'green' :
						d > 50  ? '#94CE13' :
						'#FFEDA0';
				}
			}

			function style(feature) {
				var color = '#555';
				var weight = 1;
				
				return {
					weight: weight,
					opacity: 1,
					color: color,
					dashArray: '0',
					fillOpacity: 0.7,
					fillColor: getColor(getFeatureData(feature.properties.TARGET))
				};
			}

			function highlightFeature(e) {
				var layer = e.target;
				layer.setStyle({
					weight: 2,
					color: '#666',
					dashArray: '',
					fillOpacity: 0.7
				});
				info.update(layer.feature.properties);
			}

			function resetHighlight(e) {
				geojson.resetStyle(e.target);
				info.update();
			}
			
			
			function zoomToFeature(e) {
				dialog.dialog("open");
				var data = getCovidDataByDistrict(e.target.feature.properties.TARGET);
				
				var utils = $.pivotUtilities;
				var heatmap =  utils.renderers["Table"];
				var sumOverSum =  utils.aggregators["Sum over Sum"];

				$("#dialog-form").pivot( data, {
					rows: ["Area"],
					cols: ["Outcome"],
					renderer: heatmap
				  });
				  $(".ui-dialog-title").html(e.target.feature.properties.TARGET);
			}

			function onEachFeature(feature, layer) {
				layer.on({
					mouseover: highlightFeature,
					mouseout: resetHighlight,
					click: zoomToFeature
				});
				
				addLabel(feature,layer);
			}
			
			function addLabel(feature, layer){
				var labelData = getFeatureData(feature.properties.TARGET);
				var display = labelData;
				var width = 25;
				var height = 20;
				var iconAnchor = null;
				if(labelData != 0){
					var myIcon = L.divIcon({ 
						iconSize: new L.Point(width, height), 
						iconAnchor: iconAnchor,
						html: display
					});
					if(selectedOrgUnitName != 'Nepal')
					L.marker([layer._bounds.getCenter().lat,layer._bounds.getCenter().lng], {icon: myIcon}).addTo(map).bindPopup(feature.properties.TARGET+'<br/>'+labelData);
				}
			}
			
			var legend = L.control({position: 'bottomleft'});
			legend.onAdd = function (map) {
				var div = L.DomUtil.create('div', 'info legend'),
				grades = [0, 50, 200],
				labels = ['<strong>Legend</strong>'],
				from, to;
				
				labels.push('<i style="background:' + getColor(0) + '"></i> <span>No Sessions</span>');

				for (var i = 0; i < grades.length; i++) {
					from = grades[i];
					to = grades[i + 1];

					labels.push(
						'<i style="background:' + getColor(from + 1) + '"></i> ' +
						(from+1) + (to ? '&ndash;' + to : '+'));
				}

				div.innerHTML = labels.join('<hr/>');
				return div;
			};

			legend.addTo(map);
	}
	
	// Switch between tabs
	$('body').on('click', '.tabs-nav a', function (event) {
		event.preventDefault();
		$('.tab-active').removeClass('tab-active');
		$(this).parent().addClass('tab-active');
		$('.tabs-stage div').hide();
		$($(this).attr('href')).show();
		$($(this).attr('href')+" div").show();
	});
	
	// Export data to excel
	$('body').on('click', '.download', function (event) {
		event.preventDefault();
		var target = $(this).attr('target');
		$("#"+target+" table").table2excel({
			//exclude: ".noExl",
			name: "Data",
			filename: target+"-Export",
			fileext: ".xls",
			preserveColors: true
		});
	});
	
	
}).fail(error => {
	console.warn('Failed to get manifest:', error);
});