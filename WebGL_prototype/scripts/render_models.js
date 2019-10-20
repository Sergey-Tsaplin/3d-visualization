"use strict";

var MAXBONES = 100;

var lightPosition = [2000.0, 4000.0, 4000.0];
var canvas;

var invBindMatLocation = [];
var bonesMatLocation = [];
var bindShapeMatLocation;
var positionLocation, colorLocation, normalLocation;
var bonesWeightLocation, bonesIdLocation;
var Vtranslation, Vrotation, Vscale;
var Mtranslation, Mrotation, Mscale;
var MVP_matrixLocation, MV1T_matrixLocation;
var vertexNumber, indexNumber;
var program;
var lightLocation, eyeLocation, textCoordLocation;
var MV_matrixLocation;
var gl;
var models = [];
var textureLocation;
var textures = [];
var animExec = -1;
var dbg = -1;
var playStop = "stop";
var dd = 0;

function handleLoadedTexture(texture) {
    console.log(texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

class Model {
    constructor(model_name, translation, rotation, scale, image_urls) {
        this.model_name = model_name;
        this.translation = translation;
        this.scale = scale;
        this.rotation = rotation;
        this.vertexBuffer = this.normalBuffer = this.indexBuffer = this.colorBuffer = this.texelBuffer = null;
        this.bonesIdBuffer = this.bonesWeightBuffer = null;
        this.vertexNumber = model_name.vertex.length / 3;
        this.indexNumber = model_name.index.length; 
        this.image_urls = (image_urls == undefined ? ["images/blue.png"] : image_urls);
        this.textures = null;        
        this.setBones();
        this.setVertex();
        this.setNormal();
        this.setColor();
        this.setTexel();
        this.setIndex();            
    }

    getM() {
        var M = m4.identity();
        M = m4.translate(M, this.translation[0], this.translation[1], this.translation[2]);
        M = m4.xRotate(M, this.rotation[0]);
        M = m4.yRotate(M, this.rotation[1]);
        M = m4.zRotate(M, this.rotation[2]);
        M = m4.scale(M, this.scale[0], this.scale[1], this.scale[2]);        
        return M;
    }    

    setBones() {  
        let bonesId = [];
        let bonesWeight = [];
        if (this.model_name.bones_id == undefined) {
            for (let i = 0; i < this.vertexNumber * 4; i++) {
                bonesId.push(-1);
                bonesWeight.push(0);
            }
        } else {
            bonesId = this.model_name.bones_id;
            bonesWeight = this.model_name.bones_weight;
        }

        //console.log(bonesId);
        //console.log(bonesWeight);

        this.bonesIdBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bonesIdBuffer);        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bonesId), gl.STATIC_DRAW);    
        this.bonesIdBuffer.itemSize = 4;
        this.bonesIdBuffer.numItems = this.vertexNumber;

        this.bonesWeightBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bonesWeightBuffer);        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bonesWeight), gl.STATIC_DRAW);    
        this.bonesWeightBuffer.itemSize = 4;
        this.bonesWeightBuffer.numItems = this.vertexNumber;
    }

    setVertex() {   
        // console.log("V");     
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.model_name.vertex), gl.STATIC_DRAW);    
        this.vertexBuffer.itemSize = 3;
        this.vertexBuffer.numItems = this.vertexNumber;
    }

    setNormal() {
        // console.log("N");
        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.model_name.normal), gl.STATIC_DRAW);  
        this.normalBuffer.itemSize = 3;
        this.normalBuffer.numItems = this.vertexNumber;
    }

    setColor() {
        // console.log("C");
        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        var colors = getSolidColors(this.vertexNumber);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        this.colorBuffer.itemSize = 3;
        this.colorBuffer.numItems = this.vertexNumber;
    }

    setTexel() {
        // console.log("T");
        this.texelBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texelBuffer);
        var texels = this.model_name.uv;
        if (texels == undefined) {
            texels = [];
            for (var i = 0; i < this.vertexNumber * 2; i++)
                texels.push(0.34);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texels), gl.STATIC_DRAW);
        this.texelBuffer.itemSize = 2;
        this.texelBuffer.numItems = this.vertexNumber;
    }

    setIndex() {
        // console.log("I");        

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.model_name.index), gl.STATIC_DRAW);
        this.indexBuffer.itemSize = 1;
        this.indexBuffer.numItems = this.indexNumber;
    }

    draw(matrixP, matrixV, frame_num) {
        //----------------------------------------------id костей в шейдер-------------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bonesIdBuffer);
        gl.vertexAttribPointer(bonesIdLocation, 4, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Веса костей в шейдер-----------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bonesWeightBuffer);
        gl.vertexAttribPointer(bonesWeightLocation, 4, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Вершины в шейдер---------------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Нормали в шейдер---------------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Цвета в шейдер-----------------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Тексели в шейдер---------------------------------
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texelBuffer);
        gl.vertexAttribPointer(textCoordLocation, 2, gl.FLOAT, false, 0, 0);
        //----------------------------------------------Индексы в шейдер---------------------------------
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);  

        gl.uniform3f(lightLocation, lightPosition[0], lightPosition[1], lightPosition[2]);
        gl.uniform3f(eyeLocation, 0, 0, 0);

        var matrixM = this.getM();        

        // Матрица преобразований
        var matrix_MV = m4.multiply(matrixV, matrixM);            

        // Устанавливаем матрицу преобразований вершин
        gl.uniformMatrix4fv(MVP_matrixLocation, false, m4.multiply(matrixP, matrix_MV));

        // Устанавливаем матрицу преобразований нормалей    
        var MV1T_matrix = m4.inverse(matrix_MV);
        MV1T_matrix = m4.transpose(MV1T_matrix);

        if (dd == 0) {
            dd = 1;
            console.log("matrix:");
            console.log(matrixM);
            console.log(matrixV);
            console.log(matrixP);
            console.log(matrix_MV);
            console.log(MV1T_matrix);
            console.log(m4.multiply(matrixP, matrix_MV));
        }

        gl.uniformMatrix4fv(MV1T_matrixLocation, false, MV1T_matrix);

        gl.uniformMatrix4fv(MV_matrixLocation, false, matrix_MV);
        
        for (let i = 0; i < this.model_name.bone_matrices.length; i++) {            
            gl.uniformMatrix4fv(bonesMatLocation[i], false, this.model_name.bone_matrices[i][frame_num]);
            gl.uniformMatrix4fv(invBindMatLocation[i], false, this.model_name.inverse_bind_matrices[i]);
        }
        gl.uniformMatrix4fv(bindShapeMatLocation, false, this.model_name.bind_shape_matrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
        gl.uniform1i(textureLocation, 0);

        gl.drawElements(gl.TRIANGLES, this.indexNumber, gl.UNSIGNED_SHORT, 0);
    }
}

window.onload = function () {
    var canvas = document.getElementById("canvas");
    var curMousePosition = {x: 0, y: 0};
    var isMouseDown = false;
    var isShiftDown = false;
    init();

    canvas.addEventListener('mousedown', function(e) {
        curMousePosition = {
            x: (e.pageX - this.offsetLeft),
            y: (e.pageY - this.offsetTop)};     
        isMouseDown = true;        
    }, false);

    canvas.addEventListener('mousemove', function(e) {
        var mousePosition = {
            x: (e.pageX - this.offsetLeft),
            y: (e.pageY - this.offsetTop)};   
        if (isMouseDown) {
            if (isShiftDown) {
                Vtranslation[0] += mousePosition.x - curMousePosition.x;
                Vtranslation[1] -= mousePosition.y - curMousePosition.y;
            } else {
                Vrotation[1] += (mousePosition.x - curMousePosition.x) / 70;
                Vrotation[0] += (mousePosition.y - curMousePosition.y) / 70;                
            }
            curMousePosition = mousePosition;
        }
    }, false);

    canvas.addEventListener('mouseup', function(e) {
        isMouseDown = false;         
    }, false);

    addEventListener("keydown", function(e) {
        if (e.keyCode == 16) {
            isShiftDown = true;
        }
    }, false);

    addEventListener("keyup", function(e) {
        if (e.keyCode == 16) {
            isShiftDown = false;
        }
    }, false);

    var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? "DOMMouseScroll" : "mousewheel" //FF doesn't recognize mousewheel as of FF3.x
    addEventListener(mousewheelevt, function(e) {        
        Vtranslation[2] -= ((e.deltaY || e.detail || e.wheelDelta) > 0 ? 1 : -1) * Math.sqrt(Math.abs(Vtranslation[2])) * 3;        
    }, false);

}

function radToDeg(r) {
    return r * 180 / Math.PI;
}

function degToRad(d) {
    return d * Math.PI / 180;
}

function getSolidColors(amount) {
    var colors = [];
    for (var i = 0; i < amount; i++) {
        colors.push(0); //R
        colors.push(0); //G
        colors.push(1); //B
    }
    return colors;
}

function init() {
    // Канвас во весь экран
    canvas = document.getElementById("canvas");
    canvas.width = document.getElementsByTagName("body")[0].clientWidth;
    canvas.height = document.getElementsByTagName("body")[0].clientHeight;
    // Используем WebGL в канве
    gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    // Создаём программу из шейдеров
    program = webglUtils.createProgramFromScripts(gl, ["3d-vertex-shader", "3d-fragment-shader"]);      

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }
 
    // Используем нашу пару шейдеров
    gl.useProgram(program);

    // Позиции атриб параметров координат вершин, цветов и нормалей и костей

    positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);

    normalLocation = gl.getAttribLocation(program, "a_normal");
    gl.enableVertexAttribArray(normalLocation);

    colorLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorLocation);

    textCoordLocation = gl.getAttribLocation(program, "a_textcoord");
    gl.enableVertexAttribArray(textCoordLocation);

    bonesIdLocation = gl.getAttribLocation(program, "a_bones_id");
    gl.enableVertexAttribArray(bonesIdLocation);

    bonesWeightLocation = gl.getAttribLocation(program, "a_bones_weight");
    gl.enableVertexAttribArray(bonesWeightLocation);
    

    // Позиция uniform параметра - матрицы преобразования и света    
    eyeLocation = gl.getUniformLocation(program, "u_eye_dir");
    lightLocation = gl.getUniformLocation(program, "u_light");	
    MVP_matrixLocation = gl.getUniformLocation(program, "u_MVP");
    MV1T_matrixLocation = gl.getUniformLocation(program, "u_MV1T");
    MV_matrixLocation = gl.getUniformLocation(program, "u_MV");    
    textureLocation = gl.getUniformLocation(program, "u_texture");    

    for (let i = 0; i < MAXBONES; i++) {
        invBindMatLocation[i] = gl.getUniformLocation(program, "u_inv_bind_mat[" + i + "]");
        bonesMatLocation[i] = gl.getUniformLocation(program, "u_bones_mat[" + i + "]");
    }
    bindShapeMatLocation = gl.getUniformLocation(program, "u_bind_shape_matrix");

    // Параметры сцены
    Vtranslation = [0, 0, -1500];
    Vrotation = [degToRad(30), degToRad(10), degToRad(0)];
    Vscale = [50, 50, 50];

    // Меняем размеры до размеров экрана
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // Включаем двухсторонние поверхности
    gl.enable(gl.CULL_FACE);
    // Включаем параметр глубины
    gl.enable(gl.DEPTH_TEST);  
}

function main(new_models) {
    models = new_models;      

    //console.log(models[0].model_name);
    document.getElementById("slider").min = 0;
    document.getElementById("slider").value = 0;
    document.getElementById("slider").max = models[0].model_name.frame_num - 0.001;

    setTextures();

    if (animExec == -1) {
        animExec = 1;
        setAnimation(models[0].model_name.frame_num, models[0].model_name.frame_rate);
    }
}

function setTextures() {    
    var putTextures = function(images) {
        for (var i = 0; i < images.length; i++) {
            models[i].textures = [];
            for (var j = 0; j < images[i].length; j++) {
                models[i].textures.push(gl.createTexture());
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, models[i].textures[j]);
                // задаём параметры для отображения изображения любого размера
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                // загружаем изображение в текстуру
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i][j]);
                // добавляем текстуру в массив текстур            
            }
        }
    };
    
    var images = loadImages(putTextures);
}

function loadImages(callback) {
    var images = [];
    var done = 0;

    var sum = 0;
    for (var i = 0; i < models.length; i++)
        sum += models[i].image_urls.length;

    var onImageLoad = function() {
        done++;
        if (done == sum) {
            callback(images);
        }
    };

    function loadImage(url, callback) {
        var image = new Image();
        image.src = url;
        image.onload = callback;
        return image;
    }

    for (var i = 0; i < models.length; i++) {
        images[i] = [];
        for (var j = 0; j < models[i].image_urls.length; j++)
            images[i].push(loadImage(models[i].image_urls[j], onImageLoad));
    }
}

function setAnimation(frame_num, frame_rate) {      
    console.log("frame_num = " + frame_num);
    console.log("frame_rate = " + frame_rate);
    var cur_frame = 0;
    var it = 0;

    window.setInterval(function () {              
        drawScene();
        if (playStop == "play") {
            cur_frame = document.getElementById("slider").value - 0;
            cur_frame += 1.0;
            if (cur_frame + 0.1 > frame_num) cur_frame = 0;
            document.getElementById("slider").value = cur_frame;            
        }
    }, 1000 / frame_rate);
}

// Отрисовка сцены
function drawScene() {    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Матрица проекции    
    var matrixP = m4.perspective(degToRad(30), gl.canvas.clientWidth / gl.canvas.clientHeight, 1, 2000);
    // Матрица вида
    var matrixV = m4.identity();
    matrixV = m4.translate(matrixV, Vtranslation[0], Vtranslation[1], Vtranslation[2]);
    matrixV = m4.xRotate(matrixV, Vrotation[0]);
    matrixV = m4.yRotate(matrixV, Vrotation[1]);
    matrixV = m4.zRotate(matrixV, Vrotation[2]);
    matrixV = m4.scale(matrixV, Vscale[0], Vscale[1], Vscale[2]);      
    
    let frame = document.getElementById("slider").value;
    frame = Math.trunc(frame);

    for (var i = 0; i < models.length; i++) {        
        models[i].draw(matrixP, matrixV, frame);
    }
}

function btnPlayPress() {
    playStop = "play";
}

function btnStopPress() {
    playStop = "stop";
}