function md5_count_bone(b, bones, frame, res_bones) {
    if (res_bones[b] != undefined) {
        return;
    }

    let parent = bones[b].parent;

    if (parent == -1) {
        res_bones[b] = {
            pos: bones[b].pos,
            orient: bones[b].orient
        };
    } else {
        md5_count_bone(parent);
        res_bones[b] = {
            pos: Quat.rotate(bones[parent].orient, bones[b].pos),
            orient: Quat.mult(bones[parent].orient, bones[b].orient)
        }
    }
}

function md5_bones_recalc(bones, frame) {
    let bones_num = bones.length;
    let res_bones = [];
    for (let i = 0; i < bones_num; i++) {
        res_bones.push(undefined);
    }

    for (let i = 0; i < bones_num; i++) {
        md5_count_bone(i, bones, frame, res_bones);
    }

    return res_bones;
}