import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface PageSeoProps {
  title: string;
  description: string;
  path?: string;
}

const SITE_URL = "https://seater.org";

export const PageSeo: React.FC<PageSeoProps> = ({ title, description, path }) => {
  const location = useLocation();
  const url = `${SITE_URL}${path ?? location.pathname}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default PageSeo;
