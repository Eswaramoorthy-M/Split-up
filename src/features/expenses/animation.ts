import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once for the whole Expenses chunk. Every animation is created in a
// useGSAP context with a scope ref, so filters, route changes and unmounts
// revert cleanly without leaving inline styles or listeners behind.
gsap.registerPlugin(useGSAP, ScrollTrigger)

export { gsap, useGSAP, ScrollTrigger }
