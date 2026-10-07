import { InvalidNewsEdition, parseNewsEdition, parseNewsEditions } from './news-edition';

describe('parseNewsEdition', () => {
  it('splits an edition into language and country', () => {
    expect(parseNewsEdition('he-IL')).toEqual({ code: 'he-IL', language: 'he', country: 'IL' });
    expect(parseNewsEdition(' en-US ')).toEqual({ code: 'en-US', language: 'en', country: 'US' });
  });

  it.each([['en'], ['EN-us'], ['en_US'], ['eng-USA'], ['']])('rejects %j', (value) => {
    expect(() => parseNewsEdition(value)).toThrow(InvalidNewsEdition);
  });
});

describe('parseNewsEditions', () => {
  it('parses a comma-separated list, ignoring spaces and empty entries', () => {
    expect(parseNewsEditions('en-US, he-IL,').map((edition) => edition.code)).toEqual(['en-US', 'he-IL']);
  });

  it.each([[''], [' , '], ['en-US,en-US'], ['en-US,xx']])('rejects %j', (value) => {
    expect(() => parseNewsEditions(value)).toThrow(InvalidNewsEdition);
  });
});
