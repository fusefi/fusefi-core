import {takeSnapshot, restoreSnapshot} from '.'
// And this is our test sandboxing. It snapshots and restores between each test.
// Note: if a test suite uses fastForward at all, then it MUST also use these snapshots,
// otherwise it will update the block time of the EVM and future tests that expect a
// starting timestamp will fail.
let lastSnapshotId: string;
export const addSnapshotBeforeRestoreAfterEach = () => {
  beforeEach(async () => {
    lastSnapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(lastSnapshotId);
  });
};
