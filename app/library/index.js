import { Store } from "../store.js"
import ProxyStateTree from "proxy-state-tree"
import { noChange } from "lit-html"
import { render } from "lit-html"

export const tree = new ProxyStateTree(Store)
export let Data = tree.get()

let CompState = new Map()
export let ChangedPaths = new Set()

export let Settings = { Rerender: true }
export function Lif(comp, props, parent = undefined) {
    let compId = generateKey(comp, props)
    if (!CompState.has(compId)) {
        CompState.set(compId, {
            needsRender: true,
            touched: true,
            paths: new Set(),
            mutationListener: undefined,
            parent: undefined,
            compId: undefined
        })
    }
    let state = CompState.get(compId)
    state.parent = parent
    state.touched = true
    state.compId = compId
    if (state.needsRender) {
        let trackId = tree.startPathsTracking()
        console.log("run comp: " + compId)
        let res = comp(props, compId)
        const paths = tree.clearPathsTracking(trackId)
        paths.forEach(e => {
            state.paths.add(e)
        })
        if (paths.size > 0) {
            if (state.mutationListener === undefined) {
                state.mutationListener = tree.addMutationListener(paths, () => {
                    Settings.Rerender = true
                    // flag all relevant comps to be rerendered
                    let checkState = state
                    while (checkState && !checkState.needsRender) {
                        checkState.needsRender = true
                        checkState = CompState.get(checkState.parent)
                    }
                })
            } else {
                state.mutationListener.update(paths)
            }
        }
        state.needsRender = false
        return res
    } else {
        console.log("saved some cycles: " + compId)

        //set all childs to touched = true
        setTouched(compId)
        return noChange
    }
}
function setTouched(compId) {
    Array.from(CompState.values())
        .filter(e => e.parent === compId)
        .forEach(e => {
            console.log("touch: " + e.compId)
            e.touched = true
            setTouched(e.compId)
        })
}

function generateKey(comp, props) {
    return JSON.stringify({
        1: comp.name,
        2: props
    })
}

export function StartRender(comp) {
    function mainLoop() {
        if (Settings.Rerender) {
            Settings.Rerender = false
            CompState.forEach(c => (c.touched = false))
            console.log("Start Render...")
            let res = Lif(comp, {})
            if (res !== noChange) {
                render(res, document.body)
            }
            // cleanup not touched comps
            let toDelete = []
            for (var [key, value] of CompState.entries()) {
                if (!value.touched) {
                    if (value.mutationListener) {
                        value.mutationListener.dispose()
                    }
                    toDelete.push(key)
                }
            }
            toDelete.forEach(e => CompState.delete(e))
            console.log("Finished Render. Comp State :")
            console.log(CompState)
        }
        requestAnimationFrame(mainLoop)
    }
    requestAnimationFrame(mainLoop)
}
