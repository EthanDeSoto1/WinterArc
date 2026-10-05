export const REACTIONS = [
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'muscle', emoji: '💪', label: 'Strong' },
  { kind: 'clap', emoji: '👏', label: 'Applause' },
]

function withoutMe(reaction, me) {
  return { ...reaction, mine: false, count: reaction.count - 1, people: reaction.people.filter((person) => person.id !== me.id) }
}

export function chooseReaction(item, kind, me) {
  return {
    ...item,
    reactions: item.reactions.map((reaction) => {
      if (reaction.kind === kind && reaction.mine) {
        return withoutMe(reaction, me)
      }
      if (reaction.kind === kind) {
        return { ...reaction, mine: true, count: reaction.count + 1, people: [...reaction.people, me] }
      }
      if (reaction.mine) {
        return withoutMe(reaction, me)
      }
      return reaction
    }),
  }
}

export function reactionLabel(info, reaction, me) {
  const names = reaction.people.map((person) => (person.id === me.id ? 'you' : person.displayName))
  return names.length === 0 ? `${info.label}, 0` : `${info.label}, ${names.length}: ${names.join(', ')}`
}
