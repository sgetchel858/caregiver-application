import { Link } from 'react-router'
import { Header } from '../components/Header'

export function NotFound() {
  return (
    <div className="screen">
      <Header title="Not found" back="/" />
      <div className="scroll">
        <div className="col stack main">
          <h1 className="h1">We couldn't find that page</h1>
          <p className="p muted">The link may be out of date.</p>
          <Link className="btn btn--primary" to="/">
            Go to your family
          </Link>
        </div>
      </div>
    </div>
  )
}
