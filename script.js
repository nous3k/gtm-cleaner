let form = document.querySelector('form');
let fileInput = document.querySelector('#file');
let uploadedFile;

const consoleRegex = new RegExp(/\s+console\.log\(.*\);?/);

// Listen for submit events
form.addEventListener('submit', handleSubmit);

function handleSubmit(e) {
    e.preventDefault();

    // If there's no file, do nothing
    if (!file.value.length) return;

    let reader = new FileReader();

    // Setup the callback event to run when the file is read
    reader.onload = parseFile;

    reader.readAsText(fileInput.files[0]);
}

// Parse and change the initial object
function parseFile(event) {
    let str = event.target.result;
    let json = JSON.parse(str);

    window.obj = JSON.parse(JSON.stringify(json));
    json = removeUnusedTriggers(json);
    json = removeUnusedVariables(json);
    json = removeConsoleLogsFromVariables(json);
    json = removeConsoleLogsFromTags(json);
    window.updated = json;
    linkToUpdatedJson(json);
    console.log('updated==>', json);
}

// Takes a JSON obj as a parameter and returns an array of unused trigger IDs
function getUnusedTriggerIds(obj) {
    let tags = obj.containerVersion.tag;
    let triggers = obj.containerVersion.trigger;

    let allTriggers = triggers.map((item) => item.triggerId);
    let allTriggerGroups = triggers.filter(item=>item.type==='TRIGGER_GROUP');
    let allTriggerGroupParameters = allTriggerGroups.map(item=>item.parameter);
    let allTriggerGroupLists = [].concat.apply([],allTriggerGroupParameters).map(item=>item.list);
    let allTriggersInTriggerGroups = [].concat.apply([], allTriggerGroupLists).map(item=>item.value);
    let usedTriggers = [].concat.apply([], tags.map((item) => item.firingTriggerId));
    let usedTriggersMerged = [].concat.apply(usedTriggers, allTriggersInTriggerGroups);

    return allTriggers.filter(x => !usedTriggersMerged.includes(x));
}

// Takes a JSON obj and an array of trigger IDs to remove and returns the object without these triggers
function removeUnusedTriggers(obj) {
    let arrayOfIds = getUnusedTriggerIds(obj);
    let allTriggerIds = obj.containerVersion.trigger;

    let cleanedTriggers = allTriggerIds.filter(e => !arrayOfIds.includes(e.triggerId));
    allTriggerIds = cleanedTriggers;

    return obj;
}

function getUsedVariablesInVariables(obj){
    let allVariables = [].concat.apply([], obj.containerVersion.variable);
    let allVariableParameters = allVariables.map(item=>item.parameter)
    let allVariableParemeterValues = [].concat.apply([], allVariableParameters).filter(item=>item).map(item=>item.value);
    let allUsedVariablesInVariables = allVariableParemeterValues.filter(item=>item).flatMap(item=>item.match(/\{\{(.+?)\}\}/g)).filter(item=>item);

    return allUsedVariablesInVariables.map(item=>cleanVariableName(item));
}

function cleanVariableName(name){
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
function getUsedVariablesInTags(obj){
    let tags = obj.containerVersion.tag;
    let tagParameters = [].concat.apply([],tags.map(item=>item.parameter));
    let allParameterValues = tagParameters.map(item=>item.value).filter(item=>item);
    let allListValues = tagParameters.filter(item=>item.type === 'LIST').map(item=>item.list);
    let allListUsedVariables = [].concat.apply([], [].concat.apply([], allListValues).map(item=>item.map)).flatMap(item => item.value.match(/\{\{(.+?)\}\}/g)).filter(item=>item);
    let usedVariablesInTags = allParameterValues.flatMap(item => item.match(/\{\{(.+?)\}\}/g)).filter(item => item);
    let completeListOfUsedVariables = [].concat.apply(usedVariablesInTags, allListUsedVariables).map(item=>cleanVariableName(item));

    console.log(`used variables: ${completeListOfUsedVariables}`)
    return completeListOfUsedVariables;
}

// The function removes all the collected unused variables from the object given as an argument
function removeUnusedVariables(obj){
    let currentVariables = obj.containerVersion.variable;
    let allUsedVariables = removeDuplicates(getUsedVariablesInTags(obj).concat(getUsedVariablesInVariables(obj)));
    console.log(allUsedVariables);
    currentVariables = currentVariables.filter(item=>allUsedVariables.includes(item.name));
    return obj;
}

// The function replaces all the console logs in the tags and return the updated tags
function findConsoleLogsInTags(obj){
    let htmlTags = obj.containerVersion.tag.filter(item=>item.type.includes('html'));
    htmlTags.forEach(item=>item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));

    return htmlTags;
}

function findConsoleLogsInVariables(obj){
    let jsVariables = obj.containerVersion.variable.filter(item=>item.type === 'jsm');
    jsVariables.forEach(item=>item.parameter[0].value = item.parameter[0].value.replace(consoleRegex, ''));

    return jsVariables;
}

function removeConsoleLogsFromVariables(obj){
    let currentVariables = obj.containerVersion.variable;
    let updatedVariables = findConsoleLogsInVariables(obj);

    currentVariables.forEach((item, index, array)=>{
        console.log(findConsoleLogsInVariables(obj))
        if(findConsoleLogsInVariables(obj).includes(item)){
            array.splice(index, 1);
        }
    })

    currentVariables = currentVariables.concat(updatedVariables);
    obj.containerVersion.variable = currentVariables;
    return obj;
    
}

function removeConsoleLogsFromTags(obj){
    let currentTags = obj.containerVersion.tag;
    let updatedTags = findConsoleLogsInTags(obj);


    currentTags.forEach((item, index, array)=>{
        if(findConsoleLogsInTags(obj).includes(item)){
            array.splice(index, 1);
        }
    })

    currentTags = currentTags.concat(updatedTags);
    obj.containerVersion.tag = currentTags;
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