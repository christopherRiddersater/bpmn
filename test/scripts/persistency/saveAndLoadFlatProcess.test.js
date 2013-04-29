/**
 * AUTHOR: mrassinger
 * COPYRIGHT: E2E Technologies Ltd.
 */

var pathModule = require('path');
var fileUtilsModule = require('../../../lib/utils/file.js');
var bpmnProcessModule = require('../../../lib/process.js');
var Persistency = require('../../../lib/persistency.js').Persistency;
var BPMNProcessDefinition = require('../../../lib/bpmn/processDefinition.js').BPMNProcessDefinition;
var BPMNTask = require("../../../lib/bpmn/tasks.js").BPMNTask;
var BPMNStartEvent = require("../../../lib/bpmn/startEvents.js").BPMNStartEvent;
var BPMNEndEvent = require("../../../lib/bpmn/endEvents.js").BPMNEndEvent;
var BPMNSequenceFlow = require("../../../lib/bpmn/sequenceFlows.js").BPMNSequenceFlow;

var processDefinition = new BPMNProcessDefinition("PROCESS_1", "MyTestProcessType");
processDefinition.addFlowObject(new BPMNStartEvent("_2", "MyStart", "startEvent"));
processDefinition.addFlowObject(new BPMNTask("_3", "MyTask", "task"));
processDefinition.addFlowObject(new BPMNEndEvent("_5", "MyEnd", "endEvent"));
processDefinition.addSequenceFlow(new BPMNSequenceFlow("_4", "flow1", "sequenceFlow", "_2", "_3"));
processDefinition.addSequenceFlow(new BPMNSequenceFlow("_6", "flow2", "sequenceFlow", "_3", "_5"));

var persistencyPath = pathModule.join(__dirname, '../../resources/persistency/testProcessEngine');
var persistency = new Persistency({path: persistencyPath});
var processId = "myPersistentProcess_1";
var testPropertyName = "myprop";

exports.testPersistSimpleBPMNProcess = function(test) {

    persistency.cleanAllSync();

    var handler = {
        "MyStart": function(data, done) {
            test.deepEqual(this.getState().tokens,
                [
                    {
                        "position": "MyStart",
                        "substate": null,
                        "owningProcessId": "myPersistentProcess_1"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask BEFORE SAVING"
            );done(data);
        },
        "MyTask": function(data, done) {
            test.deepEqual(this.getState().tokens,
                [
                    {
                        "position": "MyTask",
                        "substate": null,
                        "owningProcessId": "myPersistentProcess_1"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask BEFORE SAVING"
            );
            this.setProperty("anAdditionalProperty", "Value of an additional property");

            done(data);
        },
        "doneSavingHandler": function(error, savedData) {
            if (error) {
                test.ok(false, "testPersistSimpleBPMNProcess: error at saving SAVING");
                test.done();
            }

            test.deepEqual(savedData,
                {
                    "processId": "myPersistentProcess_1",
                    "data": {
                        "myprop": {
                            "an": "object"
                        },
                        "anAdditionalProperty": "Value of an additional property"
                    },
                    "state": {
                        "tokens": [
                            {
                                "position": "MyTask",
                                "substate": null,
                                "owningProcessId": "myPersistentProcess_1"
                            }
                        ]
                    },
                    "history": {
                        "historyEntries": [
                            {
                                "name": "MyStart"
                            },
                            {
                                "name": "MyTask"
                            }
                        ]
                    },
                    "_id": 1
                },
                "testPersistSimpleBPMNProcess: saved data"
            );

            test.done();
        }
    };

    var bpmnProcess = bpmnProcessModule.createBPMNProcess4Testing(processId, processDefinition, handler, persistency);
    bpmnProcess.setProperty(testPropertyName, {an: "object"});
    bpmnProcess.sendEvent("MyStart");
  };

exports.testLoadSimpleBPMNProcess = function(test) {
    var newBpmnProcess;

    var handler = {
        "MyTaskDone": function(data, done) {
            var state = this.getState();
            test.deepEqual(state.tokens,
                [
                    {
                        "position": "MyTask",
                        "substate": null,
                        "owningProcessId": "myPersistentProcess_1"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask AFTER LOADING"
            );
            // data is not in the process client interface. Thus, we have to use the process instance to get it
            test.deepEqual(newBpmnProcess.data,
                {
                    "myprop": {
                        "an": "object"
                    },
                    "anAdditionalProperty": "Value of an additional property"
                },
                "testPersistSimpleBPMNProcess: data at MyTask AFTER LOADING"
            );
            done(data);
        },
        "MyEnd": function(data, done) {
            var state = this.getState();
            test.deepEqual(state.tokens,
                [
                    {
                        "position": "MyEnd",
                        "substate": null,
                        "owningProcessId": "myPersistentProcess_1"
                    }
                ],
                "testLoadSimpleBPMNProcess: end event"
            );
            done(data);
            test.done();
        }
    };

    handler.doneLoadingHandler = function(error, loadedData) {
        if (!error && !loadedData) {
            test.ok(false, "testLoadSimpleBPMNProcess: there was nothing to load. Did saving data in the previous testcase work?");
            test.done();
        }

        if (error) {
            test.ok(false, "testLoadSimpleBPMNProcess: failed loading. Error: " + error);
            test.done();
        }

        test.equal(loadedData._id, 1, "testLoadSimpleBPMNProcess: _id");
        test.equal(loadedData.processId, "myPersistentProcess_1", "testLoadSimpleBPMNProcess:processIdd");
        test.deepEqual(loadedData.history.historyEntries,
            [
                {
                    "name": "MyStart"
                },
                {
                    "name": "MyTask"
                }
            ],
            "testLoadSimpleBPMNProcess: history"
        );
        test.deepEqual(loadedData.data,
            {
                "myprop": {
                    "an": "object"
                },
                "anAdditionalProperty": "Value of an additional property"
            },
            "testLoadSimpleBPMNProcess: data"
        );
        test.deepEqual(loadedData.state.tokens,
            [
                {
                    "position": "MyTask",
                    "substate": null,
                    "owningProcessId": "myPersistentProcess_1"
                }
            ],
            "testLoadSimpleBPMNProcess: tokens"
        );

        var myProperty = this.getProperty(testPropertyName);
        test.deepEqual(
            myProperty,
            {
                "an": "object"
            },
            "testLoadSimpleBPMNProcess: get loaded property"
        );

        // deferEvents flag is not in the process client interface. Thus, we have to use the process instance to get it
        test.ok(newBpmnProcess.deferEvents, "testLoadSimpleBPMNProcess: deferEvents");

        // deferredEvents is not in the process client interface. Thus, we have to use the process instance to get it
        var deferredEvents = newBpmnProcess.deferredEvents;
        test.deepEqual(deferredEvents,
            [
                {
                    "type": "activityFinishedEvent",
                    "name": "MyTask",
                    "data": {}
                }
            ],
            "testLoadSimpleBPMNProcess: deferred after loading");
    };

    newBpmnProcess = bpmnProcessModule.createBPMNProcess4Testing(processId, processDefinition, handler, persistency);
    newBpmnProcess.loadState();

    newBpmnProcess.taskDone("MyTask");

};