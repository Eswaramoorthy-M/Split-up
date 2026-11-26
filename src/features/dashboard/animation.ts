import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once for the whole Dashboard chunk. Every animation lives inside a
// useGSAP context with a scope ref, so switching routes reverts it cleanly.
gsap.registerPlugin(useGSAP, ScrollTrigger)

export { gsap, useGSAP, ScrollTrigger }
