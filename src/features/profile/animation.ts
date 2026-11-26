import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once for the whole Profile chunk. Every animation below is created
// inside a useGSAP context with a scope ref, so navigating away reverts it cleanly.
gsap.registerPlugin(useGSAP, ScrollTrigger)

export { gsap, useGSAP, ScrollTrigger }
