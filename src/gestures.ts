/** Modified $1 for TS & tldraw */

/**
 * The $1 Unistroke Recognizer (JavaScript version)
 *
 *  Jacob O. Wobbrock, Ph.D.
 *  The Information School
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  wobbrock@uw.edu
 *
 *  Andrew D. Wilson, Ph.D.
 *  Microsoft Research
 *  One Microsoft Way
 *  Redmond, WA 98052
 *  awilson@microsoft.com
 *
 *  Yang Li, Ph.D.
 *  Department of Computer Science and Engineering
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  yangli@cs.washington.edu
 *
 * The academic publication for the $1 recognizer, and what should be
 * used to cite it, is:
 *
 *     Wobbrock, J.O., Wilson, A.D. and Li, Y. (2007). Gestures without
 *     libraries, toolkits or training: A $1 recognizer for user interface
 *     prototypes. Proceedings of the ACM Symposium on User Interface
 *     Software and Technology (UIST '07). Newport, Rhode Island (October
 *     7-10, 2007). New York: ACM Press, pp. 159-168.
 *     https://dl.acm.org/citation.cfm?id=1294238
 *
 * The Protractor enhancement was separately published by Yang Li and programmed
 * here by Jacob O. Wobbrock:
 *
 *     Li, Y. (2010). Protractor: A fast and accurate gesture
 *     recognizer. Proceedings of the ACM Conference on Human
 *     Factors in Computing Systems (CHI '10). Atlanta, Georgia
 *     (April 10-15, 2010). New York: ACM Press, pp. 2169-2172.
 *     https://dl.acm.org/citation.cfm?id=1753654
 *
 * This software is distributed under the "New BSD License" agreement:
 *
 * Copyright (C) 2007-2012, Jacob O. Wobbrock, Andrew D. Wilson and Yang Li.
 * All rights reserved. Last updated July 14, 2018.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the names of the University of Washington nor Microsoft,
 *      nor the names of its contributors may be used to endorse or promote
 *      products derived from this software without specific prior written
 *      permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL Jacob O. Wobbrock OR Andrew D. Wilson
 * OR Yang Li BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

import { Editor, TLDrawShape, VecLike, BoxModel } from "tldraw"

const NUM_POINTS = 64
const SQUARE_SIZE = 250.0
const ORIGIN = { x: 0, y: 0 }

interface Result {
	name: string
	score: number
	time: number
	onComplete?: (editor: Editor, gesture?: TLDrawShape) => void
}

export interface Gesture {
	name: string
	points: VecLike[]
	onComplete?: (editor: Editor, gesture?: TLDrawShape) => void
}

class Unistroke {
	name: string
	points: VecLike[]
	vector: number[]
	private _originalPoints: VecLike[]
	onComplete?: (editor: Editor, gesture?: TLDrawShape) => void
	constructor(
		name: string,
		points: VecLike[],
		onComplete?: (editor: Editor, gesture?: TLDrawShape) => void,
	) {
		this.name = name
		this.onComplete = onComplete
		this._originalPoints = points
		this.points = Resample(points, NUM_POINTS)
		const radians = IndicativeAngle(this.points)
		this.points = RotateBy(this.points, -radians)
		this.points = ScaleTo(this.points, SQUARE_SIZE)
		this.points = TranslateTo(this.points, ORIGIN)
		this.vector = Vectorize(this.points) // for Protractor
	}
	originalPoints(): VecLike[] {
		return this._originalPoints
	}
}

export class DollarRecognizer {
	unistrokes: Unistroke[] = []

	constructor(gestures: Gesture[]) {
		for (const gesture of gestures) {
			this.unistrokes.push(
				new Unistroke(gesture.name, gesture.points, gesture.onComplete),
			)
		}
	}

	/**
	 * Recognize a gesture
	 * @param points The points of the gesture
	 * @returns The result
	 */
	recognize(points: VecLike[]): Result {
		const t0 = Date.now()
		const candidate = new Unistroke("", points)

		let u = -1
		let b = +Infinity
		for (
			let i = 0;
			i < this.unistrokes.length;
			i++ // for each unistroke template
		) {
			const d = OptimalCosineDistance(
				this.unistrokes[i].vector,
				candidate.vector,
			) // Protractor
			if (d < b) {
				b = d // best (least) distance
				u = i // unistroke index
			}
		}
		const t1 = Date.now()
		return u === -1
			? { name: "No match.", score: 0.0, time: t1 - t0 }
			: {
				name: this.unistrokes[u].name,
				score: 1.0 - b,
				time: t1 - t0,
				onComplete: this.unistrokes[u].onComplete,
			}
	}

	/**
	 * Add a gesture to the recognizer
	 * @param name The name of the gesture
	 * @param points The points of the gesture
	 * @returns The number of gestures
	 */
	addGesture(name: string, points: VecLike[]): number {
		this.unistrokes[this.unistrokes.length] = new Unistroke(name, points) // append new unistroke
		let num = 0
		for (let i = 0; i < this.unistrokes.length; i++) {
			if (this.unistrokes[i].name === name) num++
		}
		return num
	}

	/**
	 * Remove a gesture from the recognizer
	 * @param name The name of the gesture
	 * @returns The number of gestures after removal
	 */
	removeGesture(name: string): number {
		this.unistrokes = this.unistrokes.filter((gesture) => gesture.name !== name)
		return this.unistrokes.length
	}
}

//
// Private helper functions from here on down
//
function Resample(points: VecLike[], n: number): VecLike[] {
	const I = PathLength(points) / (n - 1) // interval length
	let D = 0.0
	const newpoints = new Array(points[0])
	for (let i = 1; i < points.length; i++) {
		const d = Distance(points[i - 1], points[i])
		if (D + d >= I) {
			const qx =
				points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x)
			const qy =
				points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y)
			const q = { x: qx, y: qy }
			newpoints[newpoints.length] = q // append new point 'q'
			points.splice(i, 0, q) // insert 'q' at position i in points s.t. 'q' will be the next i
			D = 0.0
		} else D += d
	}
	if (newpoints.length === n - 1)
		// somtimes we fall a rounding-error short of adding the last point, so add it if so
		newpoints[newpoints.length] = {
			x: points[points.length - 1].x,
			y: points[points.length - 1].y,
		}
	return newpoints
}

function IndicativeAngle(points: VecLike[]): number {
	const c = Centroid(points)
	return Math.atan2(c.y - points[0].y, c.x - points[0].x)
}

function RotateBy(points: VecLike[], radians: number): VecLike[] {
	// rotates points around centroid
	const c = Centroid(points)
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	const newpoints = new Array()
	for (let i = 0; i < points.length; i++) {
		const qx = (points[i].x - c.x) * cos - (points[i].y - c.y) * sin + c.x
		const qy = (points[i].x - c.x) * sin + (points[i].y - c.y) * cos + c.y
		newpoints[newpoints.length] = { x: qx, y: qy }
	}
	return newpoints
}

function ScaleTo(points: VecLike[], size: number): VecLike[] {
	// non-uniform scale; assumes 2D gestures (i.e., no lines)
	const B = BoundingBox(points)
	const newpoints = new Array()
	for (let i = 0; i < points.length; i++) {
		const qx = points[i].x * (size / B.w)
		const qy = points[i].y * (size / B.h)
		newpoints[newpoints.length] = { x: qx, y: qy }
	}
	return newpoints
}
function TranslateTo(points: VecLike[], pt: VecLike): VecLike[] {
	// translates points' centroid
	const c = Centroid(points)
	const newpoints = new Array()
	for (let i = 0; i < points.length; i++) {
		const qx = points[i].x + pt.x - c.x
		const qy = points[i].y + pt.y - c.y
		newpoints[newpoints.length] = { x: qx, y: qy }
	}
	return newpoints
}

function Vectorize(points: VecLike[]): number[] {
	let sum = 0.0
	const vector = new Array()
	for (let i = 0; i < points.length; i++) {
		vector[vector.length] = points[i].x
		vector[vector.length] = points[i].y
		sum += points[i].x * points[i].x + points[i].y * points[i].y
	}
	const magnitude = Math.sqrt(sum)
	for (let i = 0; i < vector.length; i++) vector[i] /= magnitude
	return vector
}

function OptimalCosineDistance(v1: number[], v2: number[]): number {
	let a = 0.0
	let b = 0.0
	for (let i = 0; i < v1.length; i += 2) {
		a += v1[i] * v2[i] + v1[i + 1] * v2[i + 1]
		b += v1[i] * v2[i + 1] - v1[i + 1] * v2[i]
	}
	const angle = Math.atan(b / a)
	return Math.acos(a * Math.cos(angle) + b * Math.sin(angle))
}

function Centroid(points: VecLike[]): VecLike {
	let x = 0.0
	let y = 0.0
	for (let i = 0; i < points.length; i++) {
		x += points[i].x
		y += points[i].y
	}
	x /= points.length
	y /= points.length
	return { x: x, y: y }
}

function BoundingBox(points: VecLike[]): BoxModel {
	let minX = +Infinity
	let maxX = -Infinity
	let minY = +Infinity
	let maxY = -Infinity
	for (let i = 0; i < points.length; i++) {
		minX = Math.min(minX, points[i].x)
		minY = Math.min(minY, points[i].y)
		maxX = Math.max(maxX, points[i].x)
		maxY = Math.max(maxY, points[i].y)
	}
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function PathLength(points: VecLike[]): number {
	let d = 0.0
	for (let i = 1; i < points.length; i++)
		d += Distance(points[i - 1], points[i])
	return d
}

function Distance(p1: VecLike, p2: VecLike): number {
	const dx = p2.x - p1.x
	const dy = p2.y - p1.y
	return Math.sqrt(dx * dx + dy * dy)
}