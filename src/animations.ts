/**
 * Pareto Pro Enterprise — Animation Registry
 * ------------------------------------------
 * Translates user-facing {@link AnimationType} into D3 transition
 * definitions, centralizing easing curves so every renderer uses the
 * same vocabulary for enter/update/exit.
 *
 * Animations are *scoped*: only the entering or changed elements get a
 * transition; the parent container does not, which keeps Power BI
 * bookmark round-trips cheap and avoids zombie tweens.
 *
 * When {@link FrameBudget.exceeded} is true, {@link animate} returns the
 * null transition so we degrade gracefully on slow hosts.
 *
 * @module    animations
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";
import * as d3Transition from "d3-transition";
import * as d3Ease from "d3-ease";
import type { Transition } from "d3-transition";

import { AnimationType } from "./interfaces";
import { FrameBudget } from "./performance";

// Ensure d3-selection's prototype picks up the .transition() extension.
d3Transition;

export type D3Selection<GElement extends d3Selection.BaseType, Datum>
    = d3Selection.Selection<GElement, Datum, d3Selection.BaseType, unknown>;
export type D3TransitionLike<GElement extends d3Selection.BaseType, Datum>
    = Transition<GElement, Datum, d3Selection.BaseType, unknown>;

export interface AnimationConfig {
    readonly type: AnimationType;
    readonly duration: number;
    readonly delay: number;
    /** When true, all animations short-circuit to a no-op transition. */
    readonly degraded: boolean;
}

/* ============================================================
   INTERNAL — easing per AnimationType
   ============================================================ */

function easeFor(type: AnimationType): (t: number) => number {
    switch (type) {
        case AnimationType.None:
            return d3Ease.linear;
        case AnimationType.Fade:
            return d3Ease.easeCubicInOut;
        case AnimationType.Grow:
            return d3Ease.easeBackOut.overshoot(1.4) as (t: number) => number;
        case AnimationType.Slide:
            return d3Ease.easeCubicIn;
        case AnimationType.Bounce:
            return d3Ease.easeBounceOut;
        case AnimationType.Elastic:
            return d3Ease.easeElasticOut.amplitude(1).period(0.45) as (t: number) => number;
        default:
            return d3Ease.easeCubicInOut;
    }
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Returns a D3 transition bound to the given selection with the user-
 * chosen type, duration, and delay. When degraded, returns a zero-duration
 * transition so updates are instantaneous but still queue properly.
 */
export function animate<GElement extends d3Selection.BaseType, Datum>(
    sel: D3Selection<GElement, Datum>,
    cfg: AnimationConfig
): D3TransitionLike<GElement, Datum> {
    const duration = cfg.degraded || cfg.type === AnimationType.None
        ? 0
        : cfg.duration;
    const delay = cfg.degraded ? 0 : cfg.delay;

    if (duration <= 0) {
        return sel.transition().duration(0).delay(0).ease(d3Ease.linear);
    }

    return sel.transition()
        .duration(duration)
        .ease(easeFor(cfg.type))
        .delay((_d, i) => delay * i);
}

/**
 * Compute the AnimationConfig for a render cycle.
 * Honors the user's enabled flag and the frame-budget degrade signal.
 */
export function config(
    type: AnimationType,
    duration: number,
    delay: number,
    enabled: boolean,
    budget: FrameBudget
): AnimationConfig {
    const degraded = !enabled || budget.exceeded;
    return {
        type: degraded ? AnimationType.None : type,
        duration: degraded ? 0 : duration,
        delay,
        degraded
    };
}

/**
 * Initial state for the enter selection by AnimationType. Used by bars
 * before the keyed-join transition runs — these are the "from" values
 * that the transition interpolates out of.
 *
 * Each renderer applies the corresponding initial state on `enter()`,
 * then transitions to the resolved final state via {@link animate}.
 */
export function enterInitial(type: AnimationType): { yDelta: number; opacity: number; scale: number } {
    switch (type) {
        case AnimationType.Fade:
            return { yDelta: 0, opacity: 0, scale: 1 };
        case AnimationType.Grow:
            return { yDelta: 1, opacity: 1, scale: 0 };
        case AnimationType.Slide:
            return { yDelta: 1, opacity: 0, scale: 1 };
        case AnimationType.Bounce:
        case AnimationType.Elastic:
            return { yDelta: 0.5, opacity: 1, scale: 0.3 };
        case AnimationType.None:
        default:
            return { yDelta: 0, opacity: 1, scale: 1 };
    }
}
