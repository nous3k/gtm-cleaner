let form = document.querySelector('form');
let fileInput = document.querySelector('#file');
let uploadedFile;
let errorMsg = document.querySelector('.error-message');
let settings = {
    'triggers': document.querySelector('#unusedTriggersCheckbox'),
    'variables': document.querySelector('#unusedVariablesCheckbox'),
    'consoleLogs': document.querySelector('#consoleLogsCheckbox')
}

function GTMObject(obj){
    this.obj = obj;
    this.variables = this.obj.containerVersion.variable;
    this.triggers = this.obj.containerVersion.trigger;
    this.tags = this.obj.containerVersion.tag;

    this.getUnusedTriggerIds = function(){
        let allTriggers = this.triggers.map((item) => item.triggerId);
        let allTriggerGroups = this.triggers.filter(item => item.type === 'TRIGGER_GROUP');
        let allTriggerGroupParameters = allTriggerGroups.map(item => item.parameter);
        let allTriggerGroupLists = flattenArray(allTriggerGroupParameters).map(item => item.list);
        let allTriggersInTriggerGroups = flattenArray(allTriggerGroupLists).map(item => item.value);
        let usedTriggers = flattenArray(this.tags.map((item) => item.firingTriggerId));
        let usedTriggersMerged = usedTriggers.concat(allTriggersInTriggerGroups);
        return allTriggers.filter(x => !usedTriggersMerged.includes(x));
    }


    this.removeUnusedTriggers = function(){
        let arrayOfIds = this.getUnusedTriggerIds(this.obj);
        this.obj.containerVersion.trigger = this.triggers.filter(e => !arrayOfIds.includes(e.triggerId));
    }

    this.getUsedVariablesInVariables = function(){
        let allVariables = flattenArray(this.variables);
        let allVariableParameters = allVariables.map(item => item.parameter)
        let allVariableParemeterValues = flattenArray(allVariableParameters).filter(item => item).map(item => item.value);
        let allUsedVariablesInVariables = allVariableParemeterValues.filter(item => item).flatMap(item => item.match(variableRegex)).filter(item => item);
        return allUsedVariablesInVariables.map(item => cleanVariableName(item));
    }

    this.getUsedVariablesInTags = function(){
        let tagParameters = flattenArray(this.tags.map(item => item.parameter));
        let allParameterValues = tagParameters.map(item => item.value).filter(item => item);
        let allListValues = tagParameters.filter(item => item.type === 'LIST').map(item => item.list);
        let allListUsedVariables = flattenArray(flattenArray(allListValues).map(item => item.map)).flatMap(item => item.value.match(variableRegex)).filter(item => item);
        let usedVariablesInTags = allParameterValues.flatMap(item => item.match(variableRegex)).filter(item => item);
        let completeListOfUsedVariables = usedVariablesInTags.concat(allListUsedVariables).map(item => cleanVariableName(item));
        return completeListOfUsedVariables;
    }

    this.removeUnusedVariables = function(){
        let allUsedVariables = removeDuplicates(this.getUsedVariablesInTags(this.obj).concat(this.getUsedVariablesInVariables(this.obj)));
        this.obj.containerVersion.variable = this.variables.filter(item => allUsedVariables.includes(item.name));
    }

    this.replaceConsoleLogsInTags = function(){
        let htmlTags = this.tags.filter(item => item.type.includes('html'));
        htmlTags.forEach(item => item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));
        return htmlTags;
    }

    this.replaceConsoleLogsInVariables = function(){
        let jsVariables = this.variables.filter(item => item.type === 'jsm');
        jsVariables.forEach(item => item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));
        return jsVariables;
    }

    this.removeConsoleLogsFromVariables = function(){
        let updatedVariables = this.replaceConsoleLogsInVariables(this.obj);
        let replacedVariables = this.variables.map(obj => updatedVariables.find(o => o.variableId === obj.variableId) || obj);
        this.obj.containerVersion.variable = replacedVariables;
    }

    this.removeConsoleLogsFromTags = function(){
        let updatedTags = this.replaceConsoleLogsInTags(this.obj);
        let replacedTags = this.tags.map(obj => updatedTags.find(o => o.tagId === obj.tagId) || obj);
        this.obj.containerVersion.tag = replacedTags;
    }

}

const consoleRegex = new RegExp(/\s+console\.log\(.*\);?/);
const variableRegex = new RegExp(/\{\{(.+?)\}\}/g);

// Listen for submit events
form.addEventListener('submit', handleSubmit);

function handleSubmit(e) {
    e.preventDefault();

    uploadedFile = fileInput.files[0];

    // Validate the uploaded file
    validateFile(uploadedFile);

    let reader = new FileReader();

    // Setup the callback event to run when the file is read
    reader.readAsText(uploadedFile);
    reader.onload = parseFile;
}

function validateFile(file) {
    if (file == null) {
        pushError('ERROR: You must choose a file!');
    }

    else if (!checkJSON(file)) {
        pushError('ERROR: The uploaded file is not a valid JSON.');
    }

    else {
        hideErrorMsg();
    }
}

function checkJSON(file) {
    return file.type === "application/json";
}

function pushError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
}


function hideErrorMsg(){
    errorMsg.style.display = "none"
}

// Parse and change the initial object
function parseFile(event) {
    let obj = JSON.parse(event.target.result);
    let gtmObject = new GTMObject(obj);
    console.log(gtmObject)


    window.obj = JSON.parse(JSON.stringify(gtmObject.obj));

    if(settings.triggers.checked){
        gtmObject.removeUnusedTriggers();
    }
    if(settings.variables.checked){
        gtmObject.removeUnusedVariables();
    }
    if(settings.consoleLogs.checked){
        gtmObject.removeConsoleLogsFromVariables();
        gtmObject.removeConsoleLogsFromTags();
    }

    window.updated = gtmObject.obj;
    linkToUpdatedJson(gtmObject.obj);
}


function cleanVariableName(name) {
    return name.replace('{{', '').replace('}}', '');
}

function removeDuplicates(arr) {
    var obj = {};
    var ret_arr = [];
    for (var i = 0; i < arr.length; i++) {
        obj[arr[i]] = true;
    }
    for (var key in obj) {
        ret_arr.push(key);
    }
    return ret_arr;
}

function flattenArray(arr) {
    return arr.reduce(function (flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten);
    }, []);
  }


// Creates a link to download the updated JSON file
function linkToUpdatedJson(obj) {
    let a = document.createElement('a');
    a.textContent = 'Download the updated JSON file... ';
    a.download = 'updated_container.json';
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
    a.target = '_blank';
    form.appendChild(a);
}