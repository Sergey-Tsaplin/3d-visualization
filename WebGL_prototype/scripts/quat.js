class Quat {
    constructor(xx, yy, zz, ww) {
        this.x = xx;
        this.y = yy;
        this.z = zz;
        if (ww == undefined) {
            let t = 1 - xx * xx - yy * yy - zz * zz;
            this.w = (t < 0 ? 0 : -Math.sqrt(t));
        } else {
            this.w = ww;
        }
    }

    static mult(a, b) {
        return new Quat(            
            (a.x * b.w) + (a.w * b.x) + (a.y * b.z) - (a.z * b.y),
            (a.y * b.w) + (a.w * b.y) + (a.z * b.x) - (a.x * b.z),
            (a.z * b.w) + (a.w * b.z) + (a.x * b.y) - (a.y * b.x),
            (a.w * b.w) - (a.x * b.x) - (a.y * b.y) - (a.z * b.z)
        );
    }

    static sum(a, b) {
        return new Quat(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
    }

    static multNum(a, x) {
        return new Quat(a.x * x, a.y * x, a.z * x, a.w * x);
    }

    inverse() {
        return new Quat(-this.x, -this.y, -this.z, this.w);
    }

    static rotate(quat, point) {
        quat_s = quat.inverse();
        quat_p = new Quat(point.x, point.y, point.z, 0);

        return mult(mult(quat, quat_p), quat_s);
    }
}