

/**
 * Extension of forms-runtime with automatic redirect to the next workflowtask if one was
 * created and it is assigned to the current user. When no more tasks are available, the user will be redirected to its original start page.
 */

(function(_submitInvoked) {
  var redirectCallback;
  /**
   * Help function to parse query parameters
   */
  _queryParam = function(key) {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for ( var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars[key];
  };

  /**
   * Callback after workflow task details have been queried, when done, this will call the original callback.
   */
  var _workflowDetailsSuccessCallback = function(response, obj) {
    ////console.log("custom _workflowDetailsSuccessCallback begin");    
    var queryParamRedir = _queryParam("redirect");
    var oldTaskId = _queryParam("taskId");
    if (queryParamRedir == null || queryParamRedir.length == 0) {
      queryParamRedir = encodeURIComponent(document.referrer); 
    }
    if (response.json.data.length>0) {
      var task = response.json.data[0];
      var taskId = task.id;

      //Only redirect if:
      //1. Task state is not completed
      //2. The current user owns the task
      //3. The target task is not the same as the current one (in case of a save action)
      if (Alfresco.constants.USERNAME == task.owner.userName && task.state!="COMPLETED" && oldTaskId != taskId) {
        var redirectURL = Alfresco.constants.URL_PAGECONTEXT + "task-edit?taskId="+ taskId +"&redirect="+queryParamRedir;
        if(typeof redirectCallback.scope.options === 'undefined'){
			redirectCallback.scope.options = {submitUrl: redirectURL};
		}else{
			redirectCallback.scope.options.submitUrl = redirectURL;
		}
      }
      else if (queryParamRedir != null) {
    	if(typeof redirectCallback.scope.options === 'undefined'){
  			redirectCallback.scope.options = {submitUrl: decodeURIComponent(queryParamRedir)};
  		}else{
  			redirectCallback.scope.options.submitUrl = decodeURIComponent(queryParamRedir);
  		}
      }      
    }
    else if (queryParamRedir != null) {
      if(typeof redirectCallback.scope.options === 'undefined'){
			redirectCallback.scope.options = {submitUrl: decodeURIComponent(queryParamRedir)};
		}else{
			redirectCallback.scope.options.submitUrl = decodeURIComponent(queryParamRedir);
		}
    }
    redirectCallback.fn.call(redirectCallback.scope, obj.response);
  };
  
  /**
   * New callback function which is called after the submit button is pressed in a workflow form.
   * This function will query alfresco for the next workflow task.
   */
  var _newSuccessCallback = function(response) {
    var persistedObject = response.json.persistedObject;
    persistedObject = persistedObject.substr(persistedObject.indexOf("WorkflowInstance"));
    var startIndex = persistedObject.indexOf("id=activiti$")+3;
    var endIndex = persistedObject.indexOf(",", 17);
    var activitiId = persistedObject.substr(startIndex, endIndex-startIndex);
    Alfresco.util.Ajax.request({
      url : Alfresco.constants.PROXY_URI + "api/workflow-instances/"+activitiId+"/task-instances?authority="+Alfresco.constants.USERNAME,
      successCallback : {
        fn : _workflowDetailsSuccessCallback,
        scope : this,
        obj : {response: response, activitiId : activitiId}              
      },
      failureMessage : Alfresco.util.message("message.failure"),
      scope : this,
      execScripts : false
    });
  };

  /**
   * Override of the _submitInvoked function for forms. Will redirect submits to a new callback function.
   */
  Alfresco.forms.Form.prototype._submitInvoked = function(event) {
    // Redirect the successcallback to a custom function
    if (redirectCallback===undefined || redirectCallback === null) {
      redirectCallback = this.ajaxSubmitHandlers.successCallback;
    }

    this.ajaxSubmitHandlers.successCallback = {
      fn : _newSuccessCallback,
      obj : null,
      scope : this
    };

    _submitInvoked.call(this, event);
  };
}(Alfresco.forms.Form.prototype._submitInvoked));
