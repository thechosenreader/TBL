import { NodeExprBody, NodeComplex, NodeIdentifier, NodeList, NodeOperation, NodeString } from "./nodes.mjs";

import { LANG } from "./language.mjs";
import assert from "assert"

function splitIndices(text, indices, includeidx = false) {
    let pairs = [[0, indices[0]], ...indices.map((v, i) => [v + 1, indices[i+1]])];
    if (includeidx) pairs = pairs.concat(indices.map(i => [i, i + 1])).sort(([a], [b]) => a - b)
    const out = pairs.map(([i1, i2]) => text.slice(i1, i2));

    return out;
}

function splitOnMultipleUncontainedDelims(text, ogs, cgs, delims, includedelim = false) {
    const indices = [];
    
    let depths = 0;
    for (const [i, c] of Object.entries(text)) {
        ogs.includes(c) && depths++;
        cgs.includes(c) && depths--;

        delims.includes(c) && depths == 0 && indices.push(parseInt(i));
    }

    return splitIndices(text, indices, includedelim);
}

function splitOnUncontainedDelim(text, og, cg, delim, includedelim = false) {
    return splitOnMultipleUncontainedDelims(text, [og], [cg], [delim], includedelim)
}

function state_machine_parse(text) {
    const out = [];

    let sstart = 0;
    let results = [];
    let start = 0;
    const ctxt = {};
    let state = "start";
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        
        switch (state) {
            case "start":
                if (c == LANG.STRING_OPEN) {
                    start = i;
                    ctxt.sdepth = 1;
                    state = "string";
                }

                else if (c == LANG.LIST_OPEN) {
                    start = i;
                    ctxt.ldepth = 1;
                    state = "list";
                }

                else if (c == LANG.EXPR_OPEN) {
                    start = i;
                    ctxt.edepth = 1;
                    state = "expression";
                }

                else if (c + text[i + 1] == LANG.COMMENT) {
                    state = "comment";
                }

                else if (LANG.OPCHARS.includes(c)) {
                    start = i;
                    state = "operator";
                }

                else if (LANG.NUMBER_START.includes(c)) {
                    start = i;
                    state = "number";
                    delete ctxt.pnum;
                }

                else if (LANG.IDENTIFIER_START.includes(c)) {
                    start = i;
                    state = "identifier";
                }

                else if (LANG.CLOSE_GROUPS.includes(c)) {
                    throw `Unmatched ${c}`;
                }

                else if (c == LANG.STATEMENT_SEPARATOR) {
                    results.length > 0 && out.push(results);
                    results = [];
                    sstart = i + 1;
                }

                break;

            case "operator":
                if (!LANG.OPCHARS.includes(c)) {
                    state = "start";
                    results.push(text.slice(start, i));
                    i--;
                }
                break;

            case "number":
                if (!LANG.NUMBER_BODY.includes(c) || (ctxt.pnum != 'e' && LANG.OPCHARS.includes(c))) {
                    state = "start";
                    results.push(text.slice(start, i));
                    i--;
                } else {
                    ctxt.pnum = c;
                }
                break;

            case "identifier":
                if (!LANG.IDENTIFIER_BODY.includes(c)) {
                    state = "start";
                    results.push(text.slice(start, i));
                    i--;
                }
                break;

            case "expression":
                if (c == LANG.EXPR_OPEN) {
                    ctxt.edepth++;
                }
                if (c == LANG.EXPR_CLOSE) {
                    ctxt.edepth--;
                    if (0 == ctxt.edepth) {
                        state = "start";
                        results.push(text.slice(start, i + 1));
                    }
                }
                break;

            case "list":
                if (c == LANG.LIST_OPEN) {
                    ctxt.ldepth++;
                }
                if (c == LANG.LIST_CLOSE) {
                    ctxt.ldepth--;
                    if (0 == ctxt.ldepth) {
                        state = "start";
                        results.push(text.slice(start, i + 1));
                    }
                }
                break;

            case "string":
                if (ctxt.escape) {
                    ctxt.escape = false;
                    continue;
                }
                if (c == LANG.ESCAPE) {
                    ctxt.escape = true;
                }


                if (c == LANG.STRING_OPEN) {
                    ctxt.sdepth++;
                }

                if (c == LANG.STRING_CLOSE) {
                    ctxt.sdepth--;
                    if (0 == ctxt.sdepth) {
                        state = "start";
                        results.push(text.slice(start, i + 1));
                    }
                }
                break;

            case "comment":
                if (c == LANG.COMMENT_SEPARATOR) {
                    state = "start";
                }
                break;
            
        }

    }

    

    assert(!["list", "expression", "string"].includes(state), "incomplete group");
    !["start", "comment"].includes(state) && results.push(text.slice(start));

    results.length > 0 && out.push(results);
    return out;

}

function parseNumber(t) {
    let n;
    if (t.startsWith(LANG.NEGATIVE)) {
        n = -parseFloat(t.slice(1));
    } else {
        n = parseFloat(t);
    }
    
    if (t.endsWith(LANG.COMPLEX)) {
        return new NodeComplex(0, n);
    } else {
        return new NodeComplex(n, 0);
    }

}

function parseText(text) {
    const results = [];

    let startidx = null;
    let depth = 0;
    let esflag = false;
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (esflag) {
            let v;
            if (c in LANG.WHITESPACE_ESCAPES) {
                v = LANG.WHITESPACE_ESCAPES[c];
            } else {
                v = c;
            }
            results.push({
                type: "escape",
                start: i - 1,
                end: i,
                value: v
            });
            esflag = false;
            continue;
        }

        if (c == LANG.ESCAPE) {
            esflag = true;
            continue;
        }

        if (c == LANG.INTERP_OPEN) {
            ++depth;
            if (startidx == null)
                startidx = i;
        }

        if (c == LANG.INTERP_CLOSE && depth > 0) {
            --depth;
            if (depth == 0 && startidx != null) {
                results.push({
                    type: "expr",
                    start: startidx,
                    end: i,
                    ast: make_ast(text.slice(startidx + 1, i))
                });

                startidx = null;
            }
        }
    }

    return results;
}


function make_ast(input) {
    const body = state_machine_parse(input);

    const asts = [];

    for (const exprs of body) {
        let values = [];
        for (const ex of exprs) {
            const e = ex.trim();
            if (e === '') continue;
            let li;
            if (e.startsWith(LANG.EXPR_OPEN)) {
                li = e.lastIndexOf(LANG.EXPR_CLOSE);
    
                if (li < 0) throw `Unmatched ${LANG.EXPR_OPEN}`;
    
                values.push(make_ast(e.slice(1, li)));
            }
    
            else if (e.startsWith(LANG.LIST_OPEN)) {
                li = e.lastIndexOf(LANG.LIST_CLOSE);
    
                if (li < 0) throw `Unmatched ${LANG.LIST_OPEN}`;
    
                if (e.slice(1, li).length == 0) {
                    values.push(new NodeList([]))
                } else {
                    const subexprs = splitOnMultipleUncontainedDelims(e.slice(1, li), LANG.OPEN_GROUPS, LANG.CLOSE_GROUPS, [LANG.LIST_SEPARATOR]);
    
                    values.push(new NodeList(subexprs.map(t => make_ast(t))))
    
                }
            }
            
            else if (e.startsWith(LANG.STRING_OPEN)) {
                if (e[e.length - 1] != LANG.STRING_CLOSE) throw `Unmatched ${LANG.STRING_OPEN}`;
                
                const text = e.slice(1, -1);
                const replacements = parseText(text);

                values.push(new NodeString(text, replacements));
            }
            else if (LANG.NUMBER_START.includes(e[0])) {
                values.push(parseNumber(e));
            }
    
            else if (!LANG.OPERATORS.includes(e)) {
                values.push(new NodeIdentifier(e));
            }
    
            else {
                values.push(e)
            }
    
        }
    
        for (const opgroup of LANG.PRECEDENCE) {
            while (opgroup.some(o => values.includes(o))) {
                const idx = values.findIndex(e => opgroup.includes(e));
                const [l, o, r] = values.splice(idx - 1, 3);
                const opr = new NodeOperation(o, l, r);
                values = values.slice(0, idx - 1).concat(opr).concat(values.slice(idx - 1))
            }
        }
        
        if (values.length == 0) continue;
        assert(values.length == 1, 'AST is malformed');
        asts.push(values[0]);
    }

    return new NodeExprBody(asts);

}

export {
    make_ast, state_machine_parse
}