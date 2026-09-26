import { Logger } from '@nestjs/common';

// Nest loggers would flood test output; assertions check return values and mocks instead.
Logger.overrideLogger(false);
