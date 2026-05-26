## DHIS2 Dashboard app to embed static remote url

This app was initially designed to display a static dashboard of Early Warning Reporting System (EWARS) in DHIS2 based national Health Management Information System (HMIS).

## Code
### index.html
```html 
<html lang="en">
<head>
	<title>EWARS Portal</title>
	<script type="text/javascript" src="https://code.jquery.com/jquery-1.12.4.js"></script>
	<script type="text/javascript" src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script>
	<script type="text/javascript" src="index.js"></script>
  <style>
    iframe {width: 100%;height: 100%;border:none}
  </style>
</head>
<body>
	<iframe id="src" src="#"></iframe>
</body>
</html>
```
### index.js
```javascript
// Get the app manifest in order to determine the location of the API
$.getJSON('manifest.webapp').done(manifest => {
    console.info('Loading app resources');
    var apiBase = manifest.activities.dhis.href + '/';
    var appKey = window.location.href.substr(apiBase.length + 6);
    appKey = appKey.substr(0, appKey.indexOf('/'));
    
    // EWARS portal URL - Update when necessary
    var portalUrl = "https://URL"; // to display when accessed directly
    var portalUrlDashboard = "https://URL"; // to display when accessed from dashboard
    
    // Get the dashboardItemId query parameter from the URL
    var dashboardItemId = (/[?&]dashboardItemId=([a-zA-Z0-9]{11})(?:&|$)/g.exec(window.location.search) || [undefined]).pop();
	
    if (!dashboardItemId) {
	// Not accessed from DHIS2 Dashboard, display EWARS public portal
	$("#src").attr("src", portalUrl);
    }else{
	// Access the users orgunit and pass it along with EWARS portal url
	var userInfoUrl = apiBase+"api/me/organisationUnits";
	$.getJSON(userInfoUrl).done(userInfo => {
		var ewarsPortalUrl = portalUrlDashboard+"?ouLevel="+userInfo[0].level+"&ouName="+userInfo[0].name+"&ouId="+userInfo[0].id;
		$("#src").attr("src", ewarsPortalUrl);
	}).fail(error => {
		console.warn('Failed to get userInfo:', error);
	});
    }
}).fail(error => {
	console.warn('Failed to get manifest:', error);
});
```
The parameters ouLevel, ouName and ouId are handelled by EWARS portal to filter the data based on the logged in user.