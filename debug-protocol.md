# Data transfer protocol for the debug connection of Tabris.js

```
interface ClientMessage {
   sessionId: string;
   type: 'log' | 'connect' | 'action-response';
   parameter: LogParameter | ConnectParameter | ActionResponseParameter;
};

interface LogParameter {
    messages: LogMessage[];
}

interface LogMessage {
    level: 'debug' | 'log' | 'info' | 'warn' | 'error';
    message: string;
};

interface ConnectParameter {
    platform: string;
    model: string;
}

interface ActionResponseParameter {
    enablePrompt: boolean;
}
```
