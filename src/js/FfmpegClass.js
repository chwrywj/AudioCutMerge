const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

module.exports = class FfmpegClass {
    constructor(props) {
        this._audioSupperCommand;
        this._audioServer;
        this._audioSourceInfo;
        this._cutAudioCommand;
        this._mergeAudioCommand;

        this.setFfmpegPath();
    }

    set audioSourceInfo(info) {
        this._audioSourceInfo = info;
    }

    get audioSourceInfo() {
        return this._audioSourceInfo;
    }

    setFfmpegPath() {
        const platform = os.platform()
        const arch = os.arch()
        const basePath = path.resolve(
            __dirname.replace('app.asar', 'app.asar.unpacked'),
            'bin',
            platform,
            // arm64 is limit supported only for macOS
            platform === 'darwin' && arch === 'arm64'
            ? 'arm64'
            : 'x64',
        )
        var name='ffmpeg';
        var binPath = path.resolve(
            basePath,
            platform === 'win32' ? `${name}.exe` : name,
        )
        .replace(/\\/g,"/")
        .replace('/src/js/bin/','/bin/');
        ffmpeg.setFfmpegPath(binPath);
    }

    getVideoOrAudioMetaData(audioPath,callback){
        ffmpeg(audioPath).ffprobe((err, data) => {
            //console.log(err)
            if(err==null && callback!=null){
                callback(data);
            }
        });
    }

    audioSupport(audioPath) {
        let p = new Promise((resolve, reject) => {
            this._audioSupperCommand = ffmpeg(audioPath).ffprobe((err, data) => {
                //console.log(data)
                if (err) {
                    reject(err);
                    return;
                }
                var streams = data.streams;
                var checkResult = {
                    audioCodecSupport: false,
                    duration: data.format.duration,
                    frameRate: null
                }
                if (streams) {
                    streams.map((value) => {
                        if (value.codec_type == 'audio' && (value.codec_name == 'aac' || 
                        value.codec_name == 'mp3')) {
                            checkResult.audioCodecSupport = true;
                        }
                    })
                }
                resolve(checkResult)
            });
        });
        return p;
    }
    createAudioServer() {
        var getParam = function(url, key) {
            var re = new RegExp("[&,?]" + key + "=([^\\&]*)", "i");
            var r = re.exec(url);
            if (r != null) {
                return decodeURIComponent(r[1]);
            }
            return null;
        };

        if (!this._audioServer && this.audioSourceInfo) {
            this._audioServer = http.createServer((request, response) => {
                console.log("on request", request.url);
                var startTime = parseInt(getParam(request.url, "startTime"));
                let audioCodec = this.audioSourceInfo.checkResult.audioCodecSupport ? 'copy' : 'aac';
                this.killAudioSupperCommand();
                this._audioSupperCommand = ffmpeg()
                    .input(this.audioSourceInfo.audioSourcePath)
                    .nativeFramerate()
                    .audioCodec(audioCodec)
                    .format('mp4')
                    .seekInput(startTime)
                    .outputOptions(
                        '-movflags', 'frag_keyframe+empty_moov+faststart',
                        '-g', '18')
                    .on('progress', function (progress) {
                        console.log('time: ' + progress.timemark);
                    })
                    .on('error', function (err) {
                        console.log('An error occurred: ' + err.message);
                    })
                    .on('end', function () {
                        console.log('Processing finished !');
                    })
                let audioStream = this._ffmpegCommand.pipe();
                audioStream.pipe(response);
            }).listen(8888);
        }
    }
    killAudioSupperCommand() {
        if (this._audioSupperCommand) {
            this._audioSupperCommand.kill();
        }
    }
    cutAudio(input, output, opts, progressCallback,endCallback,errorCallback) {
        try{
            this._cutAudioCommand = ffmpeg(input)
                .seekInput(opts.seekInput)
                .duration(Number((opts.duration/opts.speed).toFixed(3)))
            if(opts.speed!=1){
                if(opts.speed==0.25)
                    this._cutAudioCommand = this._cutAudioCommand.audioFilters('atempo=0.5,atempo=0.5');
                else if(opts.speed==4)
                    this._cutAudioCommand = this._cutAudioCommand.audioFilters('atempo=2,atempo=2');
                else
                    this._cutAudioCommand = this._cutAudioCommand.audioFilters('atempo='+opts.speed);
            }
            if(opts.volume!=1){
                this._cutAudioCommand = this._cutAudioCommand.audioFilters('volume='+Number(opts.volume.toFixed(2)));
            }
            this._cutAudioCommand = this._cutAudioCommand
                .on('start', function (commandLine) {
                    console.log('Cut start: ' + commandLine);
                })
                .on('progress', function (progress) {
                    console.log('Processing: ' + progress.percent + '% done');
                    if(progressCallback!=null){
                        progressCallback(progress);
                    }
                })
                .on('end', function (stdout, stderr) {
                    console.log('Cut succeeded!');
                    if(endCallback!=null){
                        endCallback();
                    }
                })
                .on('error', function (err, stdout, stderr) {
                    console.log('Cut error: ', err);
                    if(errorCallback!=null){
                        errorCallback();
                    }
                })
                .save(output);
        }catch(e){
            console.log(e);
            if(errorCallback!=null){
                errorCallback();
            }
        }
    }
    killCutAudioCommand() {
        if (this._cutAudioCommand) {
            this._cutAudioCommand.kill();
        }
    }

    processAudioForMerge(input, output, opts, progressCallback,endCallback,errorCallback){
        this._mergeAudioCommand = ffmpeg()
            .input(input)
            .audioCodec('libmp3lame') //libmp3lame，libfaac，libvorbis，libfdk_aac
            .audioBitrate(opts.audioBitrate)
            .duration(Number((opts.duration/opts.speed).toFixed(3)));
        if(opts.speed!=1){
            if(opts.speed==0.25)
                this._mergeAudioCommand = this._mergeAudioCommand.audioFilters('atempo=0.5,atempo=0.5');
            else if(opts.speed==4)
                this._mergeAudioCommand = this._mergeAudioCommand.audioFilters('atempo=2,atempo=2');
            else
                this._mergeAudioCommand = this._mergeAudioCommand.audioFilters('atempo='+opts.speed);
        }
        if(opts.volume!=1){
            this._mergeAudioCommand = this._mergeAudioCommand.audioFilters('volume='+Number(opts.volume.toFixed(2)));
        }
        this._mergeAudioCommand = this._mergeAudioCommand
            .on('progress', function (progress) {
                //console.log('Processing: ' + progress.percent + '% done');
                if(progressCallback!=null){
                    progressCallback(progress);
                }
            })
            .on('end', function (stdout, stderr) {
                console.log('Processing succeeded!');
                if(endCallback!=null){
                    endCallback();
                }
            })
            .on('error', function (err, stdout, stderr) {
                console.log('Processing error: ', err);
                if(errorCallback!=null){
                    errorCallback();
                }
            })
            .save(output);
    }
    mergeAudio(output,concatFileContent,endCallback,errorCallback){
        this._mergeAudioCommand = ffmpeg()
            .outputOptions(['-i','concat:'+concatFileContent,'-acodec','copy'])
            .on('end', function (stdout, stderr) {
                console.log('Merge succeeded!');
                if(endCallback!=null){
                    endCallback();
                }
            })
            .on('error', function (err, stdout, stderr) {
                console.log('Merge error: ', err);
                if(errorCallback!=null){
                    errorCallback();
                }
            })
            .save(output);
    }
    killMergeAudioCommand() {
        if (this._mergeAudioCommand) {
            this._mergeAudioCommand.kill();
        }
    }
}