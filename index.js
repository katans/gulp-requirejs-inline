var path = require('path');
var fs = require('fs');
var EOL = require('os').EOL;

var through = require('through2');
var gutil = require('gulp-util');
var glob = require('glob');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var uglify = require('uglify-js');

var requirejs   = require('requirejs'),
    PluginError = gutil.PluginError,
    File        = gutil.File;

var rev = require('gulp-rev');    

function md5(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}    

module.exports = function(options) {
	options = options || {};

	var cwdPath = path.resolve(options.dest);

	var startReg = /<!--\s*buildrjs (?:\(([^\)]+?)\))?\s+(\/?([^\s]+?))\s*-->/gim;
	var endReg = /<!--\s*endbuildrjs\s*-->/gim;
	var jsReg = /<\s*script\s+.*?src\s*=\s*"([^"]+?)".*?><\s*\/\s*script\s*>/gi;
	var startCondReg = /<!--\[[^\]]+\]>/gim;
	var endCondReg = /<!\[endif\]-->/gim;	
	var rjsReg = /<\s*script\s+.*?data-main\s*=\s*"([^"]+?)".*?><\s*\/\s*script\s*>/gi;

	function createFile(name, content) {
		var filePath = path.join(path.relative(basePath, mainPath), name)
		var isStatic = name.split('.').pop() === 'js' || name.split('.').pop() === 'css'

		if (options.outputRelativePath && isStatic)
				filePath = options.outputRelativePath + name;

		path.relative(basePath, mainPath)
		return new gutil.File({
			base: basePath,
			path: basePath+filePath,
			contents: new Buffer(content)
		})
	}

	function optimize(opts, cb) {
	    opts.out = cb;
	    opts.optimize = 'none';
	    requirejs.optimize(opts);
	}

	function getrequirePath(str){
		var reg = new RegExp('src="(.+?)"','i');
		var r = str.match(reg); 
		if(r != null){
			return r[1];
		}
		return null;
	}

	function getJsHashPath(path,path1,hash){
		path1 = path1.replace(/\.js/i,'-'+hash+'.js');
		return path+path1;
	}

	function saveFile(file,wpath,callback){
		var writeFolder = path.dirname(wpath);
		mkdirp(writeFolder, function(err){
			if (err) {
				return cb(err);
			}
			fs.writeFile(wpath,file,'utf8',function(err){
	    		if(err){
	    			return;
	    		}
	    		callback();
	    	});
		});		

	}

	function processHtml(content, push, callback) {

		var html = [];
		var sections = content.split(endReg);

		var destPath = options.dest;
		
		for (var i = 0, l = sections.length; i < l; ++i){
			var item = sections[i];

			if (item.match(startReg)) {

				var section = item.split(startReg);
				var cdnPath = section[1];
				var filePath = section[2];
		

				var mainjs = section[4];
				var requirePath = getrequirePath(mainjs);
				//requirePath = mainPath+'/'+requirePath;

				var result = uglify.minify(mainPath+'/'+requirePath);
				var hash = md5(result.code).slice(0, 8);
				var filename = requirePath.replace(/require.js/i,'require-'+hash+'.js');

				var writePath = path.resolve(cwdPath,filename);
				saveFile(result.code,writePath,function(err,data){

					var rjsopt = options.options;
					optimize(rjsopt, function(text) {
						var jshash = md5(text).slice(0, 8);
						var jswritePath = path.resolve(cwdPath,filePath.replace(/.js/i,'-'+jshash+'.js'));
						var jsresult = uglify.minify(text,{fromString: true});

						var newPath = getJsHashPath(section[1],section[2],hash);

						saveFile(jsresult.code,jswritePath,function(err,data){
							content = content.replace(/data-main="(.+?)"/ig,'data-main="'+newPath+'"').replace('<!-- endbuildrjs -->','').replace(/<!--\s*buildrjs[\s\S]* -->/i,'').replace(/src="(.+?)require.js"/ig,'src="'+cdnPath+filename+'"');	

							push(createFile(mainName,content));
							callback();
						});

					});
				});
			}
		}


	}

	return through.obj(function(file, enc, callback) {

		if (file.isNull()) {
			this.push(file); // Do nothing if no contents
			callback();
		}
		else if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-usemin', 'Streams are not supported!'));
			callback();
		}
		else {
			basePath = file.base;
			mainPath = path.dirname(file.path);
			mainName = path.basename(file.path);

			console.log('inline',file.base,file.path);
			processHtml(String(file.contents), this.push.bind(this), callback);
		}
	});	
}