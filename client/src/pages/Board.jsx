import { Link } from 'react-router'
import Page from '../components/Page.jsx'
import PostFeed from '../components/PostFeed.jsx'
import { EmptyState } from '../components/States.jsx'

export default function Board() {
  return (
    <Page eyebrow="You and your friends" title="Board">
      <PostFeed
        showComposer
        emptyState={
          <EmptyState title="Nothing posted yet" message="Share a workout, a win, or a tough day. Your friends can react to keep you going.">
            <Link to="/friends?add=1" className="flex min-h-11 items-center text-sm font-semibold text-ice-300">
              Add friends
            </Link>
          </EmptyState>
        }
      />
    </Page>
  )
}
