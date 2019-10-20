var boneMap;

function parseArray(str) {
    let a = str.split(/[ \n]/);
    let b = [];
    for (let i = 0; i < a.length; i++) {
        let x = a[i] - 0;
        if (a[i].length > 0 && x != undefined) {
            b.push(x);
        }
    }
    return b;
}

function parseStringArray(str) {
    let a = str.split(/[ \n]/);
    let b = [];
    for (let i = 0; i < a.length; i++) {
        if (a[i].length > 0) {
            b.push(a[i]);
        }
    }
    return b;    
}

function exploreBones(dir, parent_ind, anim) {    
    let ind = boneMap[dir.jAttr.name];    

    anim[ind].bones_matrix = parseArray(dir.matrix[0].jValue);        

    if (parent_ind != -1) {
        anim[ind].bones_matrix = m4.multiply(anim[ind].bones_matrix, anim[parent_ind].bones_matrix);        
        for (let i = 0; i < anim.bone_matrices[ind].length; i++) {            
            anim.bone_matrices[ind][i] = m4.multiply(anim.bone_matrices[ind][i], anim.bone_matrices[parent_ind][i]);
        }
    }

    if (dir.node != undefined) {
        for (let i = 0; i < dir.node.length; i++) {
            exploreBones(dir.node[i], ind, anim);
        }
    }
}

function getBones(anim, obj) {
    let bones_matrix = [];    
    let dir = obj[0].COLLADA[0].library_visual_scenes[0].visual_scene[0].node;
    for (let i = 1; i < dir.length; i++) {
        exploreBones(dir[i], -1, anim);
    }
}

function parseObjToModel(obj) {   
    console.log(obj[0].COLLADA[0]);     
    let _mesh = obj[0].COLLADA[0].library_geometries[0].geometry[0].mesh[0];    
    let mesh = {
        vertex: parseArray(_mesh.source[0].float_array[0].jValue),
        normal: parseArray(_mesh.source[1].float_array[0].jValue),
        texel: parseArray(_mesh.source[2].float_array[0].jValue),
        triangles: parseArray(_mesh.triangles[0].p[0].jValue)
    }

    let _controls = obj[0].COLLADA[0].library_controllers[0].controller[0].skin[0];
    let controls = {
        bind_shape_matrix: parseArray(_controls.bind_shape_matrix[0].jValue),
        bones_name: parseStringArray(_controls.source[0].Name_array[0].jValue),
        inverse_bind_matrices: parseArray(_controls.source[1].float_array[0].jValue),
        bones_weight: parseArray(_controls.source[2].float_array[0].jValue),
        v: parseArray(_controls.vertex_weights[0].v[0].jValue),
        vcount: parseArray(_controls.vertex_weights[0].vcount[0].jValue)
    }

    let ibm = [];
    for (let i = 0; i < controls.inverse_bind_matrices.length / 16; i++) {
        ibm.push([]);
        for (let j = 0; j < 16; j++) {
            ibm[i].push(controls.inverse_bind_matrices[i * 16 + j]);
        }
    }
    controls.inverse_bind_matrices = ibm;
    
    boneMap = [];
    for (let i = 0; i < controls.bones_name.length; i++) {
        boneMap[controls.bones_name[i]] = i;        
    }    

    let __anim = obj[0].COLLADA[0].library_animations[0].animation;
    let anim = [];    
    let ind;
    let frame_num = 0;
    for (let i = 0; i < __anim.length; i++) {
        let _anim = __anim[i].animation[0].source;
        ind = boneMap[__anim[i].jAttr.name];
        anim[ind] = {
            times: parseArray(_anim[0].float_array[0].jValue),
            matrix: parseArray(_anim[1].float_array[0].jValue),
            type: parseStringArray(_anim[2].Name_array[0].jValue)            
        };
        frame_num = Math.max(frame_num, anim[ind].matrix.length / 16);
    }

    let E4 = m4.identity();
    for (let iq = 0; iq < controls.bones_name.length; iq++) {
        if (anim[iq] == undefined || anim[ind].matrix == undefined) {
            anim[iq] = {
                matrix: [],
                bones_matrix: m4.identity()
            }
        }
        for (let i = 0; i < frame_num; i++) {
            for (let j = 0; j < 16; j++) {
                anim[iq].matrix.push(E4[j]);                                    
            }
        }
    }


    anim.frame_rate = obj[0].COLLADA[0].library_visual_scenes[0].visual_scene[0].extra[0].technique[0].frame_rate[0].jValue - 0;       
    anim.frame_num = frame_num; 

    return {
        mesh: mesh,
        controls: controls,
        anim: anim
    }
}

function zipMeshNormals(mesh) {
    let zip = [];
    let tri = mesh.triangles;
    let norm = mesh.normal;
    let EPS = 1e-5;
    let num = 0;
    let new_norm = [];
    
    for (let i = 0; i < norm.length / 3; i++) {
        zip[i] = -1;
        for (let j = 0; j < i; j++) {
            if (Math.abs(norm[i*3] - norm[j*3]) < EPS && Math.abs(norm[i*3+1] - norm[j*3+1]) < EPS && Math.abs(norm[i*3+2] - norm[j*3+2]) < EPS) {
                zip[i] = zip[j];
            }
        }
        if (zip[i] == -1) {
            zip[i] = num;
            new_norm.push(norm[i * 3]);
            new_norm.push(norm[i * 3 + 1]);
            new_norm.push(norm[i * 3 + 2]);
            num++;
        }
    }

    for (let i = 1; i < tri.length; i += 3) {
        tri[i] = zip[tri[i]];
    }

    mesh.normal = new_norm;
    mesh.triangles = tri;
}

function setBonesToMesh(model) {
    bones_id = [];
    bones_weight = [];

    let v_num = model.mesh.vertex.length;
    for (let i = 0; i < v_num * 4; i++) {
        bones_id.push(-1);
        bones_weight.push(0);
    }

    let conn_num = model.controls.vcount.length;
    for (let i = 0; i < conn_num; i++) {
        let bone_ind = model.controls.v[i * 2];
        let v_ind = model.controls.v[i * 2 + 1] - 1;
        let pos = v_ind * 4;
        while (bones_id[pos] != -1) {
            pos++;
        }
        if (pos >= v_ind * 4 + 4) {
            console.warn("vertex " + (v_ind + 1) + " has more than 4 connections");
        } else {
            bones_id[pos] = bone_ind;
            bones_weight[pos] = model.controls.vcount[i];
        }
    }

    model.mesh.bones_id = bones_id;
    model.mesh.bones_weight = bones_weight;
}

function recalcMeshIndex(mesh) {    
    let tri_num = mesh.triangles.length / 3;
    let indexMap = [];
    
    let index = [];
    let vertex = [];
    let normal = [];
    let num = 0;
    let bones_id = [];
    let bones_weight = [];

    for (let i = 0; i < tri_num; i++) {
        let v_ind = mesh.triangles[i * 3];
        let n_ind = mesh.triangles[i * 3 + 1];           

        let key = v_ind + "_" + n_ind;
        
        let pos = indexMap[key];
        if (pos == undefined) {
            pos = num;            
            indexMap[key] = num;
            num++;
            for (let j = 0; j < 3; j++) {
                vertex.push(mesh.vertex[v_ind * 3 + j]);
                normal.push(mesh.normal[n_ind * 3 + j]);
            }
            for (let j = 0; j < 4; j++) {
                bones_id.push(mesh.bones_id[v_ind * 4 + j]);
                bones_weight.push(mesh.bones_weight[v_ind * 4 + j]);
            }
        }        
        index.push(pos);
    }

    mesh.triangles = index;
    mesh.vertex = vertex;
    mesh.normal = normal;
    mesh.bones_id = bones_id;
    mesh.bones_weight = bones_weight;
}

function getBoneMatrices(anim) {
    let bone_matrices = [];
    for (let iq = 0; iq < anim.length; iq++) {
        bone_matrices.push([]);
        let frames = anim[iq].matrix.length / 16;        
        
        for (let i = 0; i < frames; i++) {
            bone_matrices[iq].push([]);
            for (let j = 0; j < 16; j++) {
                bone_matrices[iq][i].push(anim[iq].matrix[i * 16 + j]);
            }
        }
    }

    anim.bone_matrices = bone_matrices;
}

function readFile() {        
    let reader = new FileReader();
    let file = document.getElementById("file").files[0];
    reader.readAsText(file);
    reader.onload = function(e) {
        let xml_anim = e.target.result;
        let obj = X2J.parseXml(xml_anim);        
        let model = parseObjToModel(obj);                             
        
        zipMeshNormals(model.mesh);         
        setBonesToMesh(model);        
        recalcMeshIndex(model.mesh);                            
        
        getBoneMatrices(model.anim);
        getBones(model.anim, obj);         
                

        let collada_model = {
            vertex: model.mesh.vertex,
            normal: model.mesh.normal,
            index: model.mesh.triangles,
            bones_id: model.mesh.bones_id,
            bones_weight: model.mesh.bones_weight,
            inverse_bind_matrices: model.controls.inverse_bind_matrices,
            bind_shape_matrix: model.controls.bind_shape_matrix,
            frame_rate: model.anim.frame_rate,
            frame_num: model.anim.frame_num,
            bone_matrices: model.anim.bone_matrices
        }

        console.log(collada_model);

        main([new Model(collada_model, [0, 0, 0], [degToRad(0), degToRad(180), 0], [0.06, 0.06, 0.06])]);
    }
}