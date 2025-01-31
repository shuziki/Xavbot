const pr = global.config.PREFIX
const regex = new RegExp(`^${pr}`)
const noPrefix = ["ai"]


async function onCall({message, args,getLang}) {
  const {commands} = global.plugins;
  const called = message.args[0]?.replace(regex, "").toLowerCase();
  if(noPrefix.includes(called)) {
    const cmd = called;
    
    for(let [key,value] of commands.entries()) {
      if(key == cmd) {
        return await value({args: args, message, getLang})
      }
    }
  }
}

export default {
  onCall
}
