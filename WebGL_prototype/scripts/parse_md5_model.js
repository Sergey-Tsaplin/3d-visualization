function md5_getAnim(s) {
    var bounds = []; //xmin, xmax, ymin, ymax, zmin, zmax
    var boundsStart = -1;
    var frame = []; //frame[num][joint] = {pos(x,y,z), orient(x,y,z,w)}
    var cur_frame = 0;
    var frameStart = -1;
    var frameRate =  -1;
    for (let i = 0; i < s.length; i++) {
        if (s[i][0] == "frameRate") {
            frameRate = s[i][1] - 0;
        } else if (s[i][0] == "bounds") {
            boundsStart = 1;
        } else if (boundsStart == 1 && s[i][0] == "}") {
            boundsStart = -1;
        } else if (boundsStart == 1) {
            bounds.push({
                xmin: s[i][1] - 0,
                ymin: s[i][2] - 0,
                zmin: s[i][3] - 0,
                xmax: s[i][6] - 0,
                ymax: s[i][7] - 0,
                zmax: s[i][8] - 0
            });
        } else if (s[i][0] == "frame") {
            frameStart = 1;
            frame[cur_frame] = [];
        } else if (frameStart == 1 && s[i][0] == "}") {
            frameStart = -1;
            cur_frame++;
        } else if (frameStart == 1) {
            frame[cur_frame].push({
                pos: new Quat(s[i][0], s[i][1], s[i][2], 0),
                orient: new Quat(s[i][3], s[i][4], s[i][5])
            });
        }
    }
    return {
        frameRate: frameRate,
        bounds: bounds,
        frame: frame
    }
}

function md5_getMesh(s) {
    var joints = []; //name, parent, pos(x, y, z), orient(x, y, z[, +w])
    var numJoints = -1, startJoints = -1;
    var vert = []; //vertIndex, s, t, startWeight, countWeight
    var tri = []; //triIndex, vertIndex0, vertIndex1, vertIndex2
    var weight = []; //weightIndex joint bias pos(x, y, z)      
    var mesh = [];  
    var meshStart = -1;
    for (let i = 0; i < s.length; i++) {
        if (s[i][0] == "joints") {
            startJoints = i + 1 - 0;            
        } else if (s[i][0] == "numJoints") {
            numJoints = s[i][1] - 0;
        } else if (startJoints <= i && i < startJoints + numJoints) {                      
            joints.push({
                name: s[i][0].substr(1, s[i][0].length - 2),
                parent: s[i][1],
                pos: new Quat(s[i][3], s[i][4], s[i][5], 0),
                orient: new Quat(s[i][8], s[i][9], s[i][10])
            });
        } else if (s[i][0] == "mesh") {
            meshStart = 1;
        } else if (meshStart == 1 && s[i][0] == "}") {
            meshStart = -1;
            mesh.push({
                vert: vert,
                tri: tri,
                weight: weight
            });
        } else if (s[i][0] == "vert") {
            vert.push({
                vertIndex: s[i][1] - 0,
                s: s[i][3] - 0,
                t: s[i][4] - 0,
                startWeight: s[i][6] - 0,
                countWeight: s[i][7] - 0
            });
        } else if (s[i][0] == "tri") {
            tri.push({
                triIndex: s[i][1] - 0,
                vertIndex0: s[i][2] - 0,
                vertIndex1: s[i][3] - 0,
                vertIndex2: s[i][4] - 0,
            });
        } else if (s[i][0] == "weight") {
            weight.push({
                weightIndex: s[i][1] - 0,
                joint: s[i][2] - 0,
                bias: s[i][3] - 0,
                pos: new Quat(s[i][5], s[i][6], s[i][7], 0)
            });
        }

    }
    return {
        joints: joints,
        mesh: mesh
    };
}

function md5_getVertex(mesh, joint) {
    var vertex = [];    
    for (let i = 0; i < mesh.vert.length; i++) {        
        vertex[i] = new Quat(0, 0, 0, 0);
        for (let j = mesh[i].startWeight; j < mesh[i].startWeight + mesh[i].countWeight; j++) {
            let weight = mesh.weight[j].bias;
            let joint_num = mesh.weight[j].joint;

            let res = Quat.rotate(joint[joint_num], mesh.vert[i]);
            vertex[i] = Quat.sum(vertex[i], Quat.multNum(res, weight));            
        }        
    }
    return vertex;
}

function md5_parce(md5mesh) {
    //console.log(md5mesh);
    var s = md5mesh.split("\n");
    //console.log(s);
    for (let i = 0; i < s.length; i++) {
        let ps = -1;
        for (let j = 1; j < s[i].length; j++) {
            if (ps == -1 && s[i][j - 1] == '/' && s[i][j] == '/') {
                ps = j - 1;
            }
        }

        if (ps != -1) {
            s[i] = s[i].substr(0, ps);
        }

        let q = s[i].split(/[\t\r ]/);
        s[i] = [];
        for (let j = 0; j < q.length; j++) {
            if (q[j].length > 0) {
                s[i].push(q[j]);
            }
        }
    } 
    return s;       
}

function Main(model) {
    console.log(model);
}

function md5_readFile() {            
    var model = {anim: undefined, mesh: undefined};
    var files = document.getElementById("file").files;
    for (let i = 0; i < files.length; i++) {        
        let f = files[i];
        console.log(f.name);
        if (f.name.length > 8 && f.name.substr(f.name.length - 8, 8) == ".md5mesh") {
            let reader = new FileReader();
            reader.readAsText(f);
            reader.onload = function(e) {
                let text = e.target.result;
                let s = md5_parce(text);
                model.mesh = md5_getMesh(s);
                if (model.anim != undefined) {
                    Main(model);
                    return;
                }
            }
        } else if (f.name.length > 8 && f.name.substr(f.name.length - 8, 8) == ".md5anim") {
            let reader = new FileReader();
            reader.readAsText(f);
            reader.onload = function(e) {
                let text = e.target.result;
                let s = md5_parce(text);
                model.anim = md5_getAnim(s);
                if (model.mesh != undefined) {
                    Main(model);
                    return;
                }
            }            
        }
    }    
}