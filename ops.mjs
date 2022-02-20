import { List, Complex } from "./values.mjs";
import {
    icc, icl, ilc, ill,
    assert_le,
    isreal_fuzz,
    assert_value,
    icomp,
    assert_complex,
    isreal_strict,
    iszero_strict,
    iszero_fuzz,
} from "./checks.mjs";
import assert from "assert";
import { ERRORS } from "./errors.mjs";


const neg_complex = z => new Complex(-z.real, -z.imag);
const con_complex = z => new Complex(z.real, -z.imag);
const abs_complex = z => Math.sqrt(z.real * z.real + z.imag * z.imag);
const rad_complex = z => Math.atan2(z.imag, z.real);

const add_complex = (a, b) => new Complex(a.real + b.real, a.imag + b.imag);
const sub_complex = (a, b) => add_complex(a, neg_complex(b));

const mul_complex = (a, b) => new Complex(a.real * b.real - a.imag * b.imag, a.real * b.imag + a.imag * b.real);
const div_complex = (a, b) => {
    const z = mul_complex(a, con_complex(b));
    const d = b.real * b.real - b.imag * b.imag;

    return new Complex(z.real / d, z.imag / d);
}


const bool = v => (assert_value(v, `can not coerce non value to boolean`), !(icomp(v) && v.real == 0 && v.imag == 0))
const fbool = b => b ? new Complex(1, 0) : new Complex(0, 0);

const eq_complex = (a, b) => fbool(a.real == b.real && a.imag == b.imag);

const lt_complex = (a, b) => fbool(abs_complex(a) < abs_complex(b));
const lte_complex = (a, b) => fbool([lt_complex(a, b), eq_complex(a, b)].some(bool));

const gt_complex = (a, b) => fbool(!bool(lte_complex(a, b)));
const gte_complex = (a, b) => fbool(!bool(lt_complex(a, b)));

const pow_complex = (a, b) => {
    if (iszero_strict(b)) return new Complex(1, 0);
    if (iszero_strict(a)) {
        if (b.imag != 0 || b.real < 0) throw `can not raise 0 to the power of negative or complex power`;
        return new Complex(0, 0);
    }

    const vabs = abs_complex(a);
    let len    = Math.pow(vabs, b.real);
    const at   = rad_complex(a);
    let phase  = at * b.real;
    if (!isreal_strict(b)) {
        len /= Math.exp(at * b.imag);
        phase += b.imag * Math.log(vabs);
    }

    return new Complex(len * Math.cos(phase), len * Math.sin(phase));
    
}

function zip(...ls) {
    assert(new Set(ls.map(l => l.length)).size == 1, `Can not zip lists of unequal lengths`);
    const values = Array.from({length: ls[0]?.length}, (_, i) => ls.map(l => l.get(i)));
    return new List(values);
}

function pow(a, b) {
    let r = null;
    if (icc(a, b)) {
        if (isreal_strict(a) && isreal_strict(b) && !(a.real <= 0 && Math.abs(b.real) < 1) && !(a.real == 0 && b.real < 0))
            r = new Complex(Math.pow(a.real, b.real), 0);
        else
            r = pow_complex(a, b);
    }
    icl(a, b) && (r = b.map(e => pow(a, e)));
    ilc(a, b) && (r = b.map(e => pow(e, b)));
    ill(a, b) && (r = (zip(a, b).map(([e1, e2]) => pow(e1, e2))));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_POW(a, b);
    
}

function mul(a, b) {
    let r = null;
    icc(a, b) && (r = mul_complex(a, b));
    icl(a, b) && (r = b.map(e => mul(a, e)));
    ilc(a, b) && (r = a.map(e => mul(e, b)));
    ill(a, b) && (r = (zip(a, b).map(([e1, e2]) => mul(e1, e2))));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_MUL(a, b);
}

function div(a, b) {
    let r = null;
    icc(a, b) && (r = div_complex(a, b));
    icl(a, b) && (r = b.map(e => div(a, e)));
    ilc(a, b) && (r = a.map(e => div(e, b)));
    ill(a, b) && (r = (zip(a, b).map(([e1, e2]) => div(e1, e2))));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_DIV(a, b);
}

function add(a, b) {
    let r = null;
    icc(a, b) && (r = add_complex(a, b));
    icl(a, b) && (r = b.map(e => add(a, e)));
    ilc(a, b) && (r = a.map(e => add(e, b)));
    ill(a, b) && (r = (zip(a, b).map(([e1, e2]) => add(e1, e2))));

    if (r !== null) return r;
    throw ERRORS.INVALID_ARG_ADD(a, b);
}

function sub(a, b) {
    let r = null;
    icc(a, b) && (r = sub_complex(a, b));
    icl(a, b) && (r = b.map(e => sub(a, e)));
    ilc(a, b) && (r = a.map(e => sub(e, b)));
    ill(a, b) && (r = (zip(a, b).map(([e1, e2]) => sub(e1, e2))));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_SUB(a, b);
}

function mod(a, b) {
    let r = null;
    icc(a, b) && isreal_fuzz(a) && isreal_fuzz(b) && (r = new Complex(a.real % b.real, 0));
    icl(a, b) && (r = b.map(e => mod(a, e)));
    ilc(a, b) && (r = a.map(e => mod(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => mod(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_MOD(a, b);
}

function eq(a, b) {
    let r = null;
    icc(a, b) && (r = eq_complex(a, b));
    icl(a, b) && (r = b.map(e => eq(a, e)));
    ilc(a, b) && (r = a.map(e => eq(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => eq(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_EQ(a, b);
}

function lt(a, b) {
    let r = null;
    icc(a, b) && (r = lt_complex(a, b));
    icl(a, b) && (r = b.map(e => lt(a, e)));
    ilc(a, b) && (r = a.map(e => lt(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => lt(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_LT(a, b);
}

function gt(a, b) {
    let r = null;
    icc(a, b) && (r = gt_complex(a, b));
    icl(a, b) && (r = b.map(e => gt(a, e)));
    ilc(a, b) && (r = a.map(e => gt(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => gt(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_GT(a, b);
}

function lte(a, b) {
    let r = null;
    icc(a, b) && (r = lte_complex(a, b));
    icl(a, b) && (r = b.map(e => lte(a, e)));
    ilc(a, b) && (r = a.map(e => lte(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => lte(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_LTE(a, b);
}

function gte(a, b) {
    let r = null;
    icc(a, b) && (r = gte_complex(a, b));
    icl(a, b) && (r = b.map(e => gte(a, e)));
    ilc(a, b) && (r = a.map(e => gte(e, b)));
    ill(a, b) && (r = zip(a, b).map(([e1, e2]) => gte(e1, e2)));

    if (r !== null) return r;

    throw ERRORS.INVALID_ARG_GTE(a, b);
}


function abs(c) {
    assert_complex(c, `Can not take absolute value of non complex value`);
    return new Complex(abs_complex(c), 0);
}


export {
    zip,
    bool, fbool,
    pow, mul, div, add, sub, 
    eq, lt, lte, gt, gte, mod, abs
}