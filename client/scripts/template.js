/**
 * Created by veeramarni on 1/3/16.
 */

var videoCall = new VideoCall();
var file_uri =  'file:///tmp/kurento-hello-world-recording.webm';

Template.VideoCall.rendered = function(){
    if(videoCall){
        videoCall.videoInput =  document.getElementById('videoInput');
        videoCall.videoOutput = document.getElementById('videoOutput');
    }
}

Tracker.autorun(function(){
    Meteor.subscribe("kurentoClientEvents", Session.get('sessionId'), function(){
        KurentoClientEvents.find().observe({
            added: function(event){
                if(event.type === 'candidate'){
                    videoCall.iceCandidate(event.data);
                }else if(event.type === 'stop'){
                    videoCall.stop();
                }

            }
        })
    });
})


Template.body.events({
    'click #start' : function(e, t){
        e.preventDefault();

        videoCall.start(file_uri);
    },

    'click #stop' : function(e, t){
        e.preventDefault();
        videoCall.stop();
    },

    'click #play' : function(e, t){
        e.preventDefault();
        videoCall.play(file_uri);
    }
})