gulp-requirejs-inline
=====================
requirejs 合并&md5


=====================
var gulp = require('gulp');
var rjsInline = require('gulp-requirejs-inline');


gulp.task('usemin',function(){
    gulp.src('./src/index.html')
        .pipe(rjsInline({
                dest : './dist/',
                options : {
	                name : 'index',
	                baseUrl : './src/js/index',
	                out : 'index',
	                mainConfigFile : './src/js/index/index.js',
	                shim : {},
	                tmppath : '../src/'
            	}
        }))
        .pipe(gulp.dest('./dist/'));
});
