let form = document.querySelector('form');
let fileInput = document.querySelector('#file');
let uploadedFile;
let errorMsg = document.querySelector('.error-message');
let settings = {
    'triggers': document.querySelector('#unusedTriggersCheckbox'),
    'variables': document.querySelector('#unusedVariablesCheckbox'),
    'consoleLogs': document.querySelector('#consoleLogsCheckbox')
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
    let str = event.target.result;
    let json = JSON.parse(str);

    window.obj = JSON.parse(JSON.stringify(json));

    if(settings.triggers.checked){
        json = removeUnusedTriggers(json);
    }
    if(settings.variables.checked){
        json = removeUnusedVariables(json);
    }
    if(settings.consoleLogs.checked){
        json = removeConsoleLogsFromVariables(json);
        json = removeConsoleLogsFromTags(json);
    }

    window.updated = json;
    linkToUpdatedJson(json);
}

// Takes a JSON obj as a parameter and returns an array of unused trigger IDs
function getUnusedTriggerIds(obj) {
    let tags = obj.containerVersion.tag;
    let triggers = obj.containerVersion.trigger;

    let allTriggers = triggers.map((item) => item.triggerId);
    let allTriggerGroups = triggers.filter(item => item.type === 'TRIGGER_GROUP');
    let allTriggerGroupParameters = allTriggerGroups.map(item => item.parameter);
    let allTriggerGroupLists = [].concat.apply([], allTriggerGroupParameters).map(item => item.list);
    let allTriggersInTriggerGroups = [].concat.apply([], allTriggerGroupLists).map(item => item.value);
    let usedTriggers = [].concat.apply([], tags.map((item) => item.firingTriggerId));
    let usedTriggersMerged = [].concat.apply(usedTriggers, allTriggersInTriggerGroups);

    return allTriggers.filter(x => !usedTriggersMerged.includes(x));
}

// Takes a JSON obj and an array of trigger IDs to remove and returns the object without these triggers
function removeUnusedTriggers(obj) {
    let arrayOfIds = getUnusedTriggerIds(obj);

    obj.containerVersion.trigger = obj.containerVersion.trigger.filter(e => !arrayOfIds.includes(e.triggerId));

    return obj;
}

function getUsedVariablesInVariables(obj) {
    let allVariables = [].concat.apply([], obj.containerVersion.variable);
    let allVariableParameters = allVariables.map(item => item.parameter)
    let allVariableParemeterValues = [].concat.apply([], allVariableParameters).filter(item => item).map(item => item.value);
    let allUsedVariablesInVariables = allVariableParemeterValues.filter(item => item).flatMap(item => item.match(variableRegex)).filter(item => item);

    return allUsedVariablesInVariables.map(item => cleanVariableName(item));
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

// The function will collect all the used variables inside tags and its "list" parameters
function getUsedVariablesInTags(obj) {
    let tags = obj.containerVersion.tag;
    let tagParameters = [].concat.apply([], tags.map(item => item.parameter));
    let allParameterValues = tagParameters.map(item => item.value).filter(item => item);
    let allListValues = tagParameters.filter(item => item.type === 'LIST').map(item => item.list);
    let allListUsedVariables = [].concat.apply([], [].concat.apply([], allListValues).map(item => item.map)).filter(item=>item.value).flatMap(item => item.value.match(variableRegex)).filter(item => item);
    let usedVariablesInTags = allParameterValues.flatMap(item => item.match(variableRegex)).filter(item => item);
    let completeListOfUsedVariables = [].concat.apply(usedVariablesInTags, allListUsedVariables).map(item => cleanVariableName(item));

    return completeListOfUsedVariables;
}

// The function removes all the collected unused variables from the object given as an argument
function removeUnusedVariables(obj) {
    let allUsedVariables = removeDuplicates(getUsedVariablesInTags(obj).concat(getUsedVariablesInVariables(obj)));
    obj.containerVersion.variable = obj.containerVersion.variable.filter(item => allUsedVariables.includes(item.name));
    return obj;
}


// The function replaces all the console logs in the tags and return the updated tags
function replaceConsoleLogsInTags(obj) {
    let htmlTags = obj.containerVersion.tag.filter(item => item.type.includes('html'));
    htmlTags.forEach(item => item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));

    return htmlTags;
}

function replaceConsoleLogsInVariables(obj) {
    let jsVariables = obj.containerVersion.variable.filter(item => item.type === 'jsm');
    jsVariables.forEach(item => item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));
    
    return jsVariables;
}

function removeConsoleLogsFromVariables(obj) {
    let currentVariables = obj.containerVersion.variable;
    let updatedVariables = replaceConsoleLogsInVariables(obj);

    let replacedVariables = currentVariables.map(obj => updatedVariables.find(o => o.variableId === obj.variableId) || obj);

    obj.containerVersion.variable = replacedVariables;
    return obj;
}

function removeConsoleLogsFromTags(obj) {
    let currentTags = obj.containerVersion.tag;
    let updatedTags = replaceConsoleLogsInTags(obj);

    let replacedTags = currentTags.map(obj => updatedTags.find(o => o.tagId === obj.tagId) || obj);

    obj.containerVersion.tag = replacedTags;
    return obj;
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