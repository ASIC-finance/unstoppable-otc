import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OTCFactoryModule = buildModule("OTCFactoryModule", (m) => {
  const factory = m.contract("OTCFactory");
  return { factory };
});

export default OTCFactoryModule;
