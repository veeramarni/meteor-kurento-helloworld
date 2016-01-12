/**
 * Created by veeramarni on 1/2/16.
 */
Meteor.startup(function(){
    Future = Npm.require('fibers/future');
});
var kurentoClient = getKurentoClient();
var pipeline, endofstream = false;

/**
 * Global variables
 * @type {{}}
 */
var sessions = {};
var candidatesQueue = {};

function onError(error, sessionId) {
    if (error) {
        console.log(error);
        sessionId && stop(sessionId);
    }

}

function stop(sessionId) {
    if (sessions[sessionId]) {
        var pipeline = sessions[sessionId].pipeline;
        console.info('Releasing pipeline');
        pipeline.release();

        delete sessions[sessionId];
        delete candidatesQueue[sessionId];
    }

}


Meteor.methods({
    'onOffer': function (sessionId, sdpOffer, file_uri) {
        if (!sessionId) {
            throw new Meteor.Error("sessionId_not_defined", "Cannot use undefined sessionId.")
        }
        if (!Meteor.userId()) {
            throw new Meteor.Error("userId_not_found", "User must be logged in to send offer.");
        }
        console.log("Recording the video to : " + file_uri);
        try {
            var syncedPipeline = Meteor.wrapAsync(kurentoClient.create, kurentoClient);
            pipeline = syncedPipeline('MediaPipeline');

            var syncedWebRtc = Meteor.wrapAsync(pipeline.create, pipeline);
            var webRtc = syncedWebRtc('WebRtcEndpoint');

            //set candidates
            if (candidatesQueue[sessionId]) {
                while (candidatesQueue[sessionId].length) {

                    var candidate = candidatesQueue[sessionId].shift();
                    webRtc.addIceCandidate(candidate);
                }
            }
            webRtc.on('OnIceCandidate', Meteor.bindEnvironment(function (event) {
                    var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                    var data = {
                        sessionId : sessionId,
                        type: 'candidate',
                        data: candidate
                    };
                    KurentoClientEvents.insert(data);
                    console.log("Received new IceCanddiate");
                    console.log(event.candidate);
                }, function (error) {
                    console.log("========Error ============");
                    console.log(error);
                }
            ));
            webRtc.on('MediaStateChanged', function(event) {
                if (event.newState == "CONNECTED") {
                    console.log("MediaState is CONNECTED ... printing stats...");
                   // activateStatsTimeout();
                }else {
                    console.log("MediaState is " + event.newState)
                }
            });
            var syncedRecorder = Meteor.wrapAsync(pipeline.create, pipeline);
            var recorder = syncedRecorder('RecorderEndpoint', {uri: file_uri});


            var syncedRecorderConnect = Meteor.wrapAsync(webRtc.connect, webRtc);
            syncedRecorderConnect(recorder);
            var syncedWebRtcConnect = Meteor.wrapAsync(webRtc.connect, webRtc);
            syncedWebRtcConnect(webRtc);

            var syncedRecord = Meteor.wrapAsync(recorder.record, recorder);
            syncedRecord();

            var syncedSdpAnswer = Meteor.wrapAsync(webRtc.processOffer, webRtc);
            var sdpAnswer = syncedSdpAnswer(sdpOffer);

            sessions[sessionId] = {
                'pipeline': pipeline,
                'webRtc' : webRtc
            };
            webRtc.gatherCandidates(onError);

            return sdpAnswer;



        } catch (e) {
            onError(e, sessionId);
            throw new Meteor.Error("Error", "Unable to process offer");
        }

    },

    'onPlayOffer': function (sessionId, sdpOffer, file_uri) {
        if (!sessionId) {
            throw new Meteor.Error("sessionId_not_defined", "Cannot use undefined sessionId.")
        }
        if (!Meteor.userId()) {
            throw new Meteor.Error("userId_not_found", "User must be logged in to send offer.");
        }
        console.log("Playing the video from : " + file_uri);
        try {

            var syncedPipeline = Meteor.wrapAsync(kurentoClient.create, kurentoClient);
            pipeline = syncedPipeline('MediaPipeline');

            var syncedWebRtc = Meteor.wrapAsync(pipeline.create, pipeline);
            var webRtc = syncedWebRtc('WebRtcEndpoint');

            webRtc.on('OnIceCandidate', Meteor.bindEnvironment(function (event) {
                    var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                    var data = {
                        sessionId : sessionId,
                        type: 'candidate',
                        data: candidate
                    };
                    KurentoClientEvents.insert(data);
                    console.log("Received new IceCanddiate");
                    console.log(event.candidate);
                }, onError
            ));

            var syncedPlayer = Meteor.wrapAsync(pipeline.create, pipeline);
            var player = syncedPlayer('PlayerEndpoint', {uri: file_uri});
            console.log("Player has been created ");
            player.on('EndOfStream', Meteor.bindEnvironment(function(){
                console.log("endOfStream");
                var data = {
                    sessionId : sessionId,
                    type: 'stop'
                };
                KurentoClientEvents.insert(data);
                //stop(sessionId);
            }));

            var syncedPlayerConnect = Meteor.wrapAsync(player.connect, player);
            syncedPlayerConnect(webRtc);

            var syncedSdpAnswer = Meteor.wrapAsync(webRtc.processOffer, webRtc);
            var sdpAnswer = syncedSdpAnswer(sdpOffer);

            sessions[sessionId] = {
                'pipeline': pipeline,
                'webRtc': webRtc
            };

            webRtc.gatherCandidates(onError);

            var syncedPlay = Meteor.wrapAsync(player.play, player);
            syncedPlay();

            return sdpAnswer;

        } catch (e) {
            onError(e, sessionId);
            throw new Meteor.Error("Error", "Unable to process offer");
        }
    },

    'onStop': stop,

    'onIceCandidate': function (sessionId, _candidate) {
        console.log("Logging candidate " + JSON.stringify(_candidate));
        var candidate = kurento.register.complexTypes.IceCandidate(_candidate);
        //var candidate = _candidate;
        if (sessions[sessionId]) {
            console.info('Sending candidate');
            var webRtc = sessions[sessionId].webRtc;
            webRtc.addIceCandidate(candidate);
        } else {
            console.info('Queuing candidate');
            if (!candidatesQueue[sessionId]) {
                candidatesQueue[sessionId] = [];
            }
            candidatesQueue[sessionId].push(candidate);
        }
    }
});