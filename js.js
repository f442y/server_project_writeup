const sections = [
    ["intro_page", "Intro"],
    ["setting_up_server_nodes", "Setting Up Server Nodes"],
    ["setting_up_system_architecture", "Setting Up System Architecture"],
]

const parser = new DOMParser();
const converter = new showdown.Converter();
const sections_map = new Map();

const structure = {
    sections_map: sections_map,
    active_section: "intro_page",
    fixed_paths: {
        image_files: "/server_project_md/",
        markdown_files: "/server_project_md/",
    },
    theme_mode: "dark-mode",
}

addSectionToMap = (id, title) => {
    sections_map.set(id, {
        id: id,
        title: title,
        html_element: null
    });
}

sections.forEach(section => { addSectionToMap(section[0], section[1]) })

main = async () => {
    await githubPagesCheck();

    structure.sections_map.forEach(section => {
        initSidebarSections(section.id, section.title);
        attachSidebarListener(section.id);
    })
    await updatePage();
}

window.onload = () => {
    structure.theme_mode = halfmoon.getPreferredMode();
    switchThemeToggleImage();
    switchHLJSTheme();
}

themeChangeToggle = () => {
    halfmoon.toggleDarkMode();
    structure.theme_mode = halfmoon.getPreferredMode();
    switchThemeToggleImage();
    switchHLJSTheme();
}

switchHLJSTheme = () => {
    const hljsDarkStyle = document.getElementById("hljs-dark-style");
    const hljsLightStyle = document.getElementById("hljs-light-style");

    if (structure.theme_mode == "light-mode") {
        hljsDarkStyle.disabled = true
        hljsLightStyle.disabled = false
    } else {
        hljsDarkStyle.disabled = false
        hljsLightStyle.disabled = true
    }
}
switchThemeToggleImage = () => {
    const theme_image_element = document.getElementById("theme_img");
    if (structure.theme_mode == "light-mode") {
        theme_image_element.src = "./web_assets/moon.png";
    } else {
        theme_image_element.src = "./web_assets/sun.png";
    }
}

/**
 * To load files on github pages, the server requires the absolute path of the resource,
 * therefore, when the URL is one of "github.io", the fixed path to download the
 * markdown files uses an absolute path which includes the repository name.
 * When using a http server, the fixed path only needs to be relative.
 */
githubPagesCheck = () => {
    const hostname = window.location.hostname.split(".").slice(-2).join(".");
    if (hostname == "github.io") {
        structure.fixed_paths.markdown_files = `/${window.location.pathname.split("/")[1]}/server_project_md/`;
    }
}

updatePage = async () => {
    await fetchMD_ProcessAndAppendToStructure();
    updateSidebarAccordion();
    updateContent();
    updateSidebarContents();
}

updateSidebarAccordion = () => {
    structure.sections_map.forEach(section => {
        if (structure.active_section == section.id) {
            document.getElementById(`${section.id}_sidebar`).open = true;
        } else {
            document.getElementById(`${section.id}_sidebar`).open = false;
        }
    })
}

fetchMD_ProcessAndAppendToStructure = async () => {
    const active_section_id = structure.active_section;
    // Fetch the Markdown file in text format
    md_text = await fetchMDfile(structure.fixed_paths.markdown_files, active_section_id);

    // While the file is in text format, remove the table of contents (TOC) for the file
    md_text_no_TOC = await removeTOC(md_text);

    // Convert the Markdown text into HTML text
    html_text = await converter.makeHtml(md_text_no_TOC);

    // Convert the HTML text into a HTML document (documentElement)
    html_element = await convertTextToHtmlDocument(html_text);

    // Edit src of img tags in HTML document
    html_element = editImgSrc(html_element, structure.fixed_paths.image_files, active_section_id);

    structure.sections_map.get(active_section_id).html_element = html_element;

    document.getElementById(`${active_section_id}_sidebar_download_icon`).src = `./web_assets/download-icon-green.png`
}

fetchMDfile = async (fixed_path_md, section_name) => {
    return await fetch(`${fixed_path_md}${section_name}/${section_name}.md`)
        .then(r => r.text())
        .then(t => {
            return t;
        });
}

/**
 * The markdown files contain an automatically generated table of contents (TOC).
 * To prevent the table from being processed into HTML, it is removed.
 * The markdown file contains a comment to mark the beginning and end of the table.
 * <!-- TOC:start --> and <!-- TOC:end -->
 * All text between these two comments is removed.
 */
removeTOC = async (md_text) => {
    const nregex = new RegExp("<!-- TOC:start -->[\\d\\D]*?\<!-- TOC:end -->", "g");
    return md_text.replace(nregex, "");
}

convertTextToHtmlDocument = (html_text) => {
    return parser.parseFromString(html_text, 'text/html');
}

/**
 * As the src tags of all images in the markdown files are defined relatively, the src 
 * tags need to be redefined to the full path relative to the index.html file.
 */
editImgSrc = (html_element, fixed_path_images, section_name) => {
    html_element.querySelectorAll("img").forEach(img => {
        img.src = img.src.replace("/resources", `${fixed_path_images}${section_name}/resources`);
    })
    return html_element;
}

initSidebarSections = (section_id, section_title) => {
    let details_element = document.createElement("details");
    details_element.id = `${section_id}_sidebar`;
    details_element.classList.add("collapse-panel");

    let summary_element = document.createElement("summary");
    summary_element.classList.add("collapse-header", "sidebar-link", "sidebar-link-with-icon", "without-arrow");

    let summary_element_icon = document.createElement("span");
    summary_element_icon.classList.add("sidebar-icon");
    let summary_element_icon_img = document.createElement("img");
    summary_element_icon_img.id = `${section_id}_sidebar_download_icon`;
    summary_element_icon_img.src = `./web_assets/download-icon.png`;
    summary_element_icon_img.classList.add("img-fluid", "w-three-quarter");
    summary_element_icon.append(summary_element_icon_img);
    summary_element.append(summary_element_icon);

    summary_element.append(section_title);

    var content_element = document.createElement("div");
    content_element.id = `${section_id}_sidebar_content`;
    content_element.classList.add("collapse-content");
    content_element.innerHTML = "Generating Contents..."

    details_element.append(summary_element);
    details_element.append(content_element);



    document.getElementById("sidebar-sections").appendChild(details_element);
}

attachSidebarListener = (section_id) => {

    document.getElementById(`${section_id}_sidebar`).addEventListener(
        "click",
        () => {
            structure.active_section = section_id;
            updatePage();
        },
    )

}

updateContent = async () => {
    let content = document.getElementById("content");
    content.innerHTML = "";
    const element = structure.sections_map.get(structure.active_section).html_element.cloneNode(true);
    const elements_in_body_list = Array.prototype.slice.call(element.body.querySelectorAll('body > *'));
    elements_in_body_list.forEach(element => {
        const a = element.querySelectorAll("a");
        if (a.length > 0) {
            editContentLinkTags(a);
        };
        document.getElementById("content").appendChild(element);
    })

    addClassesToTags();
}

updateSidebarContents = () => {
    const contents = document.createElement("div");
    contents.id = "toc";

    const active_section_id = structure.active_section;
    const element = structure.sections_map.get(active_section_id).html_element.cloneNode(true);
    const headers_in_body_list = element.body.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headers_in_body_list.forEach(header => {
        const div = document.createElement("div");
        div.classList.add("container");
        const a = document.createElement("a");
        a.innerHTML = header.innerHTML;
        a.href = `#${header.id}`;
        a.classList.add(`ml-${(header.tagName.charAt(1) * 5) - 10}`)
        div.append(a);
        if (header.tagName.charAt(1) < 4) {
            div.classList.add("pt-20", "font-weight-semi-bold");
            contents.append(div);
            const divider = document.createElement("div")
            divider.classList.add("sidebar-divider");
            contents.append(divider);
        } else {
            contents.append(div);
        }

    })
    sidebar_content_element = document.getElementById(`${active_section_id}_sidebar_content`);
    sidebar_content_element.innerHTML = "";
    sidebar_content_element.append(contents);
}

editContentLinkTags = async (anchorElement) => {
    anchorElement.forEach(a => {
        const href = a.getAttribute("href");
        if (href.charAt(0) == "#") {
            a.setAttribute("href", href.replaceAll("-", ""));
        } else {
            a.setAttribute("target", "_blank")
        };

    });
}


/**
 * To correctly format the HTML, classes need to be added to the HTML tags, this allows 
 * the correct CSS formatting of the HTML elements.
 */
addClassesToTags = () => {
    // Root div of section
    html_element = document.getElementById("content")

    // Individual tags of section
    html_element.querySelectorAll("p").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("h2").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("img").forEach(tag => {
        tag.classList.add("img-fluid", "rounded");
    });
    html_element.querySelectorAll("code").forEach(tag => {
        tag.classList.add("hljs");
    });
    html_element.querySelectorAll("pre").forEach(tag => {
        tag.classList.add("scroll", "hljs");
    });
    html_element.querySelectorAll("blockquote").forEach(tag => {
        tag.classList.add("text-muted");
    });

}

main();