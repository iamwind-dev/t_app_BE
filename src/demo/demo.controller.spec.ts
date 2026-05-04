import { Response } from 'express';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  it('serves the demo index file', () => {
    const controller = new DemoController();
    const sendFile = jest.fn();
    const response = {
      sendFile,
    } as unknown as Response;

    controller.index(response);

    expect(sendFile).toHaveBeenCalledWith(expect.stringMatching(/public[\\/]demo[\\/]index\.html$/));
  });
});
