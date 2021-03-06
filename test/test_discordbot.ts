import * as Chai from "chai";
import * as ChaiAsPromised from "chai-as-promised";
import * as Proxyquire from "proxyquire";
import * as Discord from "discord.js";
import { Log } from "../src/log";

import { MessageProcessorMatrixResult } from "../src/messageprocessor";
import { MockGuild } from "./mocks/guild";
import { MockMember } from "./mocks/member";
import { DiscordBot } from "../src/bot";
import { MockDiscordClient } from "./mocks/discordclient";

Chai.use(ChaiAsPromised);

const assert = Chai.assert;
// const should = Chai.should as any;

const mockBridge = {
  getRoomStore: () => {
    return {
      getEntriesByRemoteRoomData: (data) => {
        if (data.discord_channel === "321") {
          return Promise.resolve([{
            matrix: {
              getId: () => "foobar:example.com",
            },
          }]);
        }
        return Promise.resolve([]);
      },
    };
  },
  getIntentFromLocalpart: (localpart: string) => {
    return {
      sendTyping: (room: string, isTyping: boolean) => {
        return;
      },
    };
  },
  getUserStore: () => {
    return {};
  },
};

const modDiscordBot = Proxyquire("../src/bot", {
  "./clientfactory": require("./mocks/discordclientfactory"),
});
describe("DiscordBot", () => {
  let discordBot;
  const config = {
    auth: {
        botToken: "blah",
    },
    bridge: {
        domain: "localhost",
    },
    limits: {
        discordSendDelay: 50,
    },
  };
  describe("run()", () => {
    it("should resolve when ready.", () => {
      discordBot = new modDiscordBot.DiscordBot(
        config,
        null,
      );
      discordBot.setBridge(mockBridge);
      return discordBot.run();
    });
  });

  describe("LookupRoom()", () => {
    beforeEach(() => {
      discordBot = new modDiscordBot.DiscordBot(
        config,
        null,
      );
      discordBot.setBridge(mockBridge);
      return discordBot.run();
    });
    it("should reject a missing guild.", () => {
      return assert.isRejected(discordBot.LookupRoom("541", "321"));
    });

    it("should reject a missing channel.", () => {
      return assert.isRejected(discordBot.LookupRoom("123", "666"));
    });

    it("should resolve a guild and channel id.", () => {
      return assert.isFulfilled(discordBot.LookupRoom("123", "321"));
    });
  });
  describe("OnMessageUpdate()", () => {
    it("should return on an unchanged message", () => {
      discordBot = new modDiscordBot.DiscordBot(
        config,
        mockBridge,
      );

      const guild: any = new MockGuild("123", []);
      guild._mockAddMember(new MockMember("12345", "TestUsername"));
      const channel = new Discord.TextChannel(guild, null);
      const oldMsg = new Discord.Message(channel, null, null);
      const newMsg = new Discord.Message(channel, null, null);
      oldMsg.embeds = [];
      newMsg.embeds = [];

      // Content updated but not changed
      oldMsg.content = "a";
      newMsg.content = "a";

      // Mock the SendMatrixMessage method to check if it is called
      let checkMsgSent = false;
      discordBot.SendMatrixMessage = (...args) => checkMsgSent = true;

      discordBot.OnMessageUpdate(oldMsg, newMsg).then(() => {
        Chai.assert.equal(checkMsgSent, false);
      });
    });

    it("should send a matrix message on an edited discord message", () => {
      discordBot = new modDiscordBot.DiscordBot(
        config,
        mockBridge,
      );

      const guild: any = new MockGuild("123", []);
      guild._mockAddMember(new MockMember("12345", "TestUsername"));
      const channel = new Discord.TextChannel(guild, null);
      const oldMsg = new Discord.Message(channel, null, null);
      const newMsg = new Discord.Message(channel, null, null);
      oldMsg.embeds = [];
      newMsg.embeds = [];

      // Content updated and edited
      oldMsg.content = "a";
      newMsg.content = "b";

      // Mock the SendMatrixMessage method to check if it is called
      let checkMsgSent = false;
      discordBot.SendMatrixMessage = (...args) => checkMsgSent = true;

      discordBot.OnMessageUpdate(oldMsg, newMsg).then(() => {
        Chai.assert.equal(checkMsgSent, true);
      });
    });
  });
  describe("event:message", () => {
    it("should delay messages so they arrive in order", async () => {
        discordBot = new modDiscordBot.DiscordBot(
          config,
          mockBridge,
      );
        let expected = 0;
        discordBot.OnMessage = (msg: any) => {
          assert.equal(msg.n, expected);
          expected++;
          return Promise.resolve();
      };
        const client: MockDiscordClient = (await discordBot.ClientFactory.getClient()) as MockDiscordClient;
        discordBot.setBridge(mockBridge);
        await discordBot.run();
        const ITERATIONS = 25;
        const CHANID = 123;
        // Send delay of 50ms, 2 seconds / 50ms - 5 for safety.
        for (let i = 0; i < ITERATIONS; i++) {
          client.emit("message", { n: i, channel: { id: CHANID} });
      }
        await discordBot.discordMessageQueue[CHANID];
    });
  });

  // describe("ProcessMatrixMsgEvent()", () => {
  //
  // });
  // describe("UpdateRoom()", () => {
  //
  // });
  // describe("UpdateUser()", () => {
  //
  // });
  // describe("UpdatePresence()", () => {
  //
  // });
  // describe("OnTyping()", () => {
  //   const discordBot = new modDiscordBot.DiscordBot(
  //     config,
  //   );
  //   discordBot.setBridge(mockBridge);
  //   discordBot.run();
  //   it("should reject an unknown room.", () => {
  //     return assert.isRejected(discordBot.OnTyping( {id: "512"}, {id: "12345"}, true));
  //   });
  //   it("should resolve a known room.", () => {
  //     return assert.isFulfilled(discordBot.OnTyping( {id: "321"}, {id: "12345"}, true));
  //   });
  // });
  // describe("OnMessage()", () => {
  //
  // });
});
