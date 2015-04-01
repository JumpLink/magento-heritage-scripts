module.exports = function (options) {
    var events = require('events');
    var eventEmitter = new events.EventEmitter();
    var terminal = require('child_process').spawn('bash');

    var resultStream = "";

    var isJson = function (text) {
        if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').
        replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
        replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
            //the json is ok
            return true;
        }else{
            //the json is not ok
            return false;
        }
    }

    var parseInput = function (input) {
        var inputs = input.split("\n");
        for (var i = 0; i < inputs.length; i++) {
            switch(inputs[i]) {
                case 'READY':
                    eventEmitter.emit('ready');
                break;
                case 'FINISH':
                    eventEmitter.emit('finish');
                break;
                case 'RESULT':
                   resultStream = "";
                break;
                default:
                    resultStream += inputs[i];
                break;
            }
        };
    }

    var startMagentoApi = function () {
        terminal.stdout.on('data', function (data) {
            //console.log('\n\nstdout: ' + data+"\n\n");
            parseInput(data.toString());
        });

        terminal.stderr.on('data', function (data) {
            console.error('stderr: ' + data);
        });

        terminal.on('exit', function (code) {
            // console.log('child process exited with code ' + code);
            eventEmitter.emit('exit', code);
        });

        // console.log('Sending stdin to terminal\nphp "'+options.path+'"\n');
        terminal.stdin.write('php "'+options.path+'"\n');
    }

    var callApi = function (options) {
        // setTimeout(function () {
        //   eventEmitter.emit('error', '{"error":"timeout"}');
        // }, options.timeout);
        var jsonString = JSON.stringify(options);
        // console.log('Sending stdin to terminal\n'+jsonString+'\n');
        terminal.stdin.write(jsonString+'\n');
        // var EOF = "\nEOF\n";
        // terminal.stdin.write(EOF);
        terminal.stdin.end();
    }

    eventEmitter.on('finish', function () {

        // terminal.stdin.end();
        // console.log(resultStream);
        if(isJson(resultStream)) {
            var result = JSON.parse(resultStream);
        } else {
            eventEmitter.emit('error', '{"error":'+resultStream+'}');
        }

        //console.log(result);

        // console.log('result_'+result.method);

        if(typeof result.result !== 'undefined')
            eventEmitter.emit('result_'+result.method, result.result);
        else if (typeof result.error !== 'undefined')
            eventEmitter.emit('error', result.error);
        else 
            eventEmitter.emit('error', '{"error":'+result+'}');
    });

    eventEmitter.on('error', function (message) {
        console.log(message);
        terminal.stdin.end();
        terminal.kill('SIGKILL');
    });

    eventEmitter.on('exit', function (code) {
        terminal.stdin.end();
        terminal.kill('SIGHUP');
    });

    return {
        start: startMagentoApi
        , call: callApi
        , event: eventEmitter
    }
};
