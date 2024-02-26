import { ethers } from "ethers";

const b = 0.0000000000000000006766;
const a = b.toLocaleString('fullwide', {useGrouping: false, maximumFractionDigits: 18})

console.log(a)

console.log(ethers.utils.parseUnits(a, "ether"))

// console.log(ethers.utils.parseUnits(a, "ether"))
