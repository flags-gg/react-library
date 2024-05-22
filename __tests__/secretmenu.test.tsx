import {formatFeatureName} from '../secretmenu.tsx'

describe('formatFeatureName', () => {
  it('should capitalize the first letter of each word and add a space before capital letters', () => {
    expect(formatFeatureName('featureName')).toEqual('Feature Name');
    expect(formatFeatureName('feature')).toEqual('Feature');
    expect(formatFeatureName('FeatureNAME')).toEqual('Feature Name');
    expect(formatFeatureName('Feature123Name')).toEqual('Feature 123 Name');
  });
});


