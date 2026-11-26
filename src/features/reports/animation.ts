import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once for the whole Reports chunk. Every animation below is created
// inside a useGSAP context, so a route change or month change reverts it cleanly.
gsap.registerPlugin(useGSAP, ScrollTrigger)

export { gsap, useGSAP, ScrollTrigger }
