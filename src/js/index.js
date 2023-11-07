new Vue({
    el: "#body-container",
    data() {
        return {
            langRes:null,

            tabActiveName: 'cut',

            // videoExtArr:['mp4','avi','mkv','mov','flv','swf','mpeg','mpg','ts'],
            audioExtArr:['mp3','wav','aiff','au','wma','flac','ogg','aac','ra','rm'],
            // imageExtArr:['jpg','jpeg','png','gif','bmp','tiff'],
            audioBitrateArr:[64,96,128,160,192,256,320],

            tableLoading:false,

            audioSpeedArr:[4,2,1,0.5,0.25],
            audioElement:null, //audio播放器元素对象
            audioPath:null, //音频路径
            audioDuration:0, //音频时常
            audioPlayTime:0, //音频当前播放的时长
            audioSliderValue:0, //音频播放进度条值，值为audioPlayTime*1000
            audioPlaying:false, //音频是否在播放中
            audioSpeed:1, //音频播放倍速
            cutOptions:{
                cutting:false,
                speed:1,
                startTime:null,
                endTime:null,
                volume:1,
                outputFileFullPath:null,
                cutPercent:0
            },

            mergeData:[],
            mergeOptions:{
                mergeIng:false,
                speed:1,
                audioBitrate:128,
                volume:1,
                outputFileFullPath:null,
                mergeAudioTempDirName:'MergeAudioTempDir',
                mergeAudioTempDirPath:'',
                mergePercent:0,
                concatFileContent:''
            },
        }
    },
    computed:{
        //音频播放时长时分秒字符串
        audioPlayDurationStr(){
            var time=this.audioPlayTime>this.audioDuration?this.audioDuration:this.audioPlayTime
            return this.transDurationStr(time);
        },
        audioTotalDurationStr(){
            return this.transDurationStr(this.audioDuration);
        },
        audioSliderMax(){
            return parseInt(this.audioDuration*1000,10)
        },

        fileMergePercent(){
            if(this.mergeData.length==0)
                return 0;
            var filterData = this.mergeData.filter(item => {
                return item.status == 2 || item.status == 3
            });
            
            return parseInt((filterData.length/this.mergeData.length)*100,10);
        }
    },
    mounted() {
        setTimeout(()=>{
            document.title = this.lang("title");
        },100)

        electronAPI.audioInfoForCut((event, playParams) => {
            console.log(playParams);
            if(this.audioPath!=null)
                this.getAudioElement().currentTime=0;
            this.audioPath=playParams.audioSource;
            this.audioDuration=playParams.duration;
            this.audioPlayTime=0;
            this.audioSliderValue=0;
            this.audioPlaying=false;
        });
    },
    methods: {
        isNullOrEmpty(str) {
            if (str == null || typeof str == "undefined" || String(str).trim() == "")
                return true;
            else
                return false;
        },

        toNum(str){
            if(this.isNullOrEmpty(str) || isNaN(str))
                return null;
            else
                return Number(str);
        },

        //multilingual
        getLangStr(key){
            var keyArr=key.split('.');
            var langObj=this.langRes[keyArr[0]];
            for(var i=1;i<keyArr.length;i++){
                langObj=langObj[keyArr[i]];
            }
            return langObj;
        },
        lang(key){
            if(this.langRes==null){
                window.customApi.getLangRes()
                .then(data=>{
                    this.langRes=data;
                    return this.getLangStr(key);
                })
                .catch((e) => {
                    return key;
                });
            }else{
                return this.getLangStr(key);
            }
        },

        dialogOpenFile(type){
            var extArr=[];
            var multiSelections;
            if(type=='cutAudio'){
                extArr=['mp3'];
                multiSelections=false;
            }else{
                extArr=this.audioExtArr;
                multiSelections=true;
            }
            electronAPI.dialogOpenFile(extArr,multiSelections)
            .then(filePaths=>{
                if(filePaths!=null && filePaths.length>0){
                    if(type=='cutAudio'){
                        electronAPI.selectAudioForCut(filePaths[0]);
                    }else{
                        this.tableLoading=true;
                        setTimeout(()=>{
                            for(var i=0;i<filePaths.length;i++){
                                this.mergeData.push({
                                    sourcePath:filePaths[i],
                                    sourceSize:null,
                                    sourceDuration:null,
                                    sourceAudioBitrate:null,
                                    processed:false
                                });
    
                                electronAPI.getVideoOrAudioMetaData(filePaths[i],(metaData)=>{
                                    var filterData = this.mergeData.filter(item => {
                                        return item.sourcePath == metaData.format.filename
                                    });
                                    filterData.forEach(item=>{
                                        item.sourceSize=metaData.format.size;
                                        item.sourceDuration=metaData.format.duration;
                                        for(var k=0;k<metaData.streams.length;k++){
                                            if(metaData.streams[k].codec_type=='audio'){
                                                item.sourceAudioBitrate=metaData.streams[k].bit_rate;
                                            }
                                        }
                                    });
                                    console.log(metaData)
                                });
                            }
                            this.tableLoading=false;
                        },50);
                    }
                }
            });
        },

        async dialogOpenDirectory(dirType){
            const dirPaths = await window.electronAPI.dialogOpenDirectory()
            if(dirPaths==null || dirPaths=='')
                return;
            if(dirType=="curOutput"){
                this.cutOptions.outputPath = dirPaths;
                this.$refs['cutOptionsForm'].clearValidate(['outputPath']);
            }else if(dirType=="mergeOutput"){
                this.mergeOptions.outputPath = dirPaths;
                this.$refs['mergeOptionsForm'].clearValidate(['outputPath']);
            }else if(dirType=="mergeInput"){
                var mergeData = window.electronAPI.getFilesFromDir(dirPaths,this.audioExtArr);
                if(mergeData!=null && mergeData.length>0){
                    this.tableLoading=true;
                    setTimeout(()=>{
                        for(var i=0;i<mergeData.length;i++){
                            this.mergeData.push({
                                sourcePath:mergeData[i].filePath,
                                sourceSize:null,
                                sourceDuration:null,
                                sourceAudioBitrate:null,
                                processed:false
                            });

                            electronAPI.getVideoOrAudioMetaData(mergeData[i].filePath,(metaData)=>{
                                var filterData = this.mergeData.filter(item => {
                                    return item.sourcePath == metaData.format.filename
                                });
                                filterData.forEach(item=>{
                                    item.sourceSize=metaData.format.size;
                                    item.sourceDuration=metaData.format.duration;
                                    for(var k=0;k<metaData.streams.length;k++){
                                        if(metaData.streams[k].codec_type=='audio'){
                                            item.sourceAudioBitrate=metaData.streams[k].bit_rate;
                                        }
                                    }
                                });
                            });
                        }
                        this.tableLoading=false;
                    },50);
                }
            }
        },

        renameForNewFile(filePath){
            if(electronAPI.fileExists(filePath)){
                return this.renameForNewFile(filePath.replace(".","(1)."));
            }
            return filePath;
        },

        newFormatChange(e){
            this.mergeOptions.newFormat=e;
            for(var i=0;i<this.mergeData.length;i++){
                this.mergeData[i].newFormat=e;
            }
        },
        
        volumeTooltip(val){
            return parseInt(val*100,10)+'%';
        },

        getAudioElement(){
            if(this.audioElement==null)
                this.audioElement=document.getElementById("audio");
            return this.audioElement;
        },
        transDurationStr(duration){
            var durationInt=parseInt(duration,10);
            var durationStr=duration.toFixed(3)+"";
            var minute=parseInt(durationInt/60,10)
            var second=parseInt(durationInt%60,10)
            return (minute<10?"0"+minute:minute)+":"+
                (second<10?"0"+second:second)+
                durationStr.substring(durationStr.indexOf('.'));
        },
        audioPlayPause(){
            if (this.getAudioElement().paused){
                this.audioPlaying=true;
                this.getAudioElement().play();
            } else {
                this.audioPlaying=false;
                this.getAudioElement().pause();
            }
        },
        audioSpeedChange(speed){
            this.audioSpeed=speed;
            this.getAudioElement().playbackRate=speed;
            document.querySelectorAll('.el-tooltip__popper').forEach(item=>{
                item.style.display='none';
            });
        },
        audioPlayTimeUpdate(){
            this.audioPlayTime=this.getAudioElement().currentTime;
            this.audioSliderValue=parseInt(this.audioPlayTime*1000,10);
        },
        audioSliderInput(e){
            if(e!=parseInt(this.audioPlayTime*1000,10)){
                this.getAudioElement().pause();
            }
        },
        audioSliderChange(e){
            if(this.audioPath.indexOf('http://')!=-1){
                this.audioPath="http://127.0.0.1:8888?startTime="+(e/1000);
            }
            this.getAudioElement().currentTime=e/1000;
            this.getAudioElement().play();
        },
        audioSliderFormatTooltip(val){
            return this.transDurationStr(val/1000);
        },
        prevFrame(){
            this.getAudioElement().currentTime-=0.03;
            this.getAudioElement().pause();
        },
        nextFrame(){
            this.getAudioElement().currentTime+=0.03;
            this.getAudioElement().pause();
        },
        setCutStartTime(){
            if(!this.cutOptions.cutting){
                this.cutOptions.startTime=this.audioPlayDurationStr;
                this.$refs['cutOptionsForm'].clearValidate(['startTime']);
            }else{
                this.$message.warning(this.lang('settingTimeTip1'));
            }
        },
        setCutEndTime(){
            if(!this.cutOptions.cutting){
                this.cutOptions.endTime=this.audioPlayDurationStr;
                this.$refs['cutOptionsForm'].clearValidate(['endTime']);
            }else{
                this.$message.warning(this.lang('settingTimeTip1'));
            }
        },
        goCut(){
            if(this.cutOptions.cutting){
                electronAPI.killCutAudioCommand();
                this.cutOptions.cutting=false;
                this.cutOptions.cutPercent=0;
                setTimeout(() => {
                    electronAPI.deleteFile(this.cutOptions.outputFileFullPath);
                }, 1000);
                return;
            }
            this.$refs['cutOptionsForm'].validate((valid) => {
                if (valid) {
                    var startTimeArr = this.cutOptions.startTime.split(':');
                    var startTime=Number(startTimeArr[0]) * 60 + Number(startTimeArr[1]);
                    var endTimeArr = this.cutOptions.endTime.split(':');
                    var endTime=Number(endTimeArr[0]) * 60 + Number(endTimeArr[1]);
                    if(startTime>=endTime){
                        this.$message.error(this.lang('settingTimeTip2'));
                        return;
                    }
                    
                    electronAPI.diaglogSaveFile(this.audioExtArr)
                    .then(filePath=>{
                        if(this.isNullOrEmpty(filePath))return;
                        this.cutOptions.cutting=true;
                        
                        this.cutOptions.outputFileFullPath=filePath;

                        var opts={
                            speed:this.cutOptions.speed,
                            seekInput:startTime,
                            duration:endTime-startTime,
                            volume:this.cutOptions.volume
                        };
                        electronAPI.cutAudio(this.audioPath, this.cutOptions.outputFileFullPath, opts,
                        (progress)=>{
                            if(this.isNullOrEmpty(progress.percent))return;
                            this.cutOptions.cutPercent=progress.percent.toFixed(1);
                        },()=>{
                            setTimeout(() => {
                                this.cutOptions.cutPercent=100;
                                this.$alert(this.lang('cutOver'), this.lang('tip'), {
                                    confirmButtonText: this.lang('ok'),
                                    callback: action => {
                                        this.cutOptions.cutPercent=0;
                                        this.cutOptions.cutting=false;
                                    }
                                });
                            }, 800);
                        },()=>{
                            this.cutOptions.cutPercent=0;
                            this.cutOptions.cutting=false;
                            this.$message.error(this.lang('cutFailed'));
                            setTimeout(() => {
                                electronAPI.deleteFile(this.cutOptions.outputFileFullPath);
                            }, 1000);
                        });
                    });;
                }
            });
        },

        delMergeDataRow(scope){
            if(this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData.splice(scope.$index, 1);
        },
        moveUpMergeDataRow(scope){
            if(scope.$index==0 || this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData[scope.$index-1] = this.mergeData.splice(scope.$index, 1, this.mergeData[scope.$index-1])[0];
        },
        moveDownMergeDataRow(scope){
            if(scope.$index==this.mergeData.length-1 || this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData[scope.$index+1] = this.mergeData.splice(scope.$index, 1, this.mergeData[scope.$index+1])[0];
        },
        killMergeAudioCommand(){
            electronAPI.killMergeAudioCommand();
            this.mergeOptions.mergeIng=false;
            this.mergeData.forEach(t=>{
                t.processed=false;
            });
            this.mergeOptions.mergePercent=0;
            setTimeout(() => {
                electronAPI.deleteDir(this.mergeOptions.mergeAudioTempDirPath);
            }, 1000);
        },
        goMerge(){
            if(this.mergeOptions.mergeIng){
                this.killMergeAudioCommand();
                return;
            }

            electronAPI.diaglogSaveFile(this.audioExtArr)
            .then(filePath=>{
                if(this.isNullOrEmpty(filePath))return;
                this.mergeOptions.outputFileFullPath=filePath.replace(/\\/g,"/");
                this.mergeOptions.mergeAudioTempDirPath=
                    this.mergeOptions.outputFileFullPath.substring(0,this.mergeOptions.outputFileFullPath.lastIndexOf('/'))
                    +"/"+this.mergeOptions.mergeAudioTempDirName;
                electronAPI.makeDir(this.mergeOptions.mergeAudioTempDirPath);

                this.mergeOptions.mergeIng=true;
                this.mergeOptions.concatFileContent='';
                this.processAudioForMerge();
            });
        },
        processAudioForMerge(){
            for(var i=0;i<this.mergeData.length;i++){
                if(!this.mergeOptions.mergeIng)
                    return;
                
                if(this.mergeData[i].processed){
                    continue;
                }

                var tempAudioPath=this.mergeOptions.mergeAudioTempDirPath+'/'+i+'.mp3';
                electronAPI.processAudioForMerge(this.mergeData[i].sourcePath, tempAudioPath, {
                    duration:this.mergeData[i].sourceDuration,
                    speed:this.mergeOptions.speed,
                    audioBitrate:this.mergeOptions.audioBitrate,
                    volume:this.mergeOptions.volume
                },(progress)=>{
                    if(this.isNullOrEmpty(progress.percent))return;
                    var percentData=[0,0];
                    for(var j=0;j<this.mergeData.length;j++){
                        if(j<i){
                            percentData[0]+=Number(this.mergeData[j].sourceSize);
                        }else if(j==i){
                            percentData[0]+=parseInt(Number(this.mergeData[j].sourceSize)*progress.percent/100,10);
                        }
                        percentData[1]+=Number(this.mergeData[j].sourceSize);
                    }
                    percentData[1]+=10000;
                    this.mergeOptions.mergePercent=((percentData[0]/percentData[1])*100).toFixed(1);
                },()=>{
                    this.mergeData[i].processed=true;
                    this.mergeOptions.concatFileContent+=(i!=0?'|':'')+tempAudioPath;
                    var filterData = this.mergeData.filter(item => {
                        return !item.processed
                    });
                    if(filterData.length==0){
                        this.mergeAudio();
                    }else{
                        this.processAudioForMerge();
                    }
                },()=>{
                    this.$message.error(this.lang('mergeFailed'));
                    this.killMergeAudioCommand();
                });

                break;
            }
        },
        mergeAudio(){
            electronAPI.mergeAudio(this.mergeOptions.outputFileFullPath,this.mergeOptions.concatFileContent,()=>{
                this.mergeOptions.mergePercent=100;
                this.$alert(this.lang('mergeOver'), this.lang('tip'), {
                    confirmButtonText: this.lang('ok'),
                    callback: action => {
                        this.mergeOptions.mergePercent=0;
                        this.mergeOptions.mergeIng=false;
                        electronAPI.deleteDir(this.mergeOptions.mergeAudioTempDirPath);
                    }
                });
            },()=>{
                this.$message.error(this.lang('mergeFailed'));
                this.killMergeAudioCommand();
            });
        },

        openBrowser(url){
            window.electronAPI.openBrowser(url);
        },

        openPath(url){
            window.electronAPI.openPath(url);
        }
    }
});